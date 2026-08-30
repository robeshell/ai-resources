/** Pure parsing of Agent CLI output. Kept out of curator-server.mjs because
 *  importing that file starts an HTTP listener, which makes it untestable. */

/**
 * Claude Code validates `--json-schema` with a resolver that cannot fetch the
 * 2020-12 meta-schema, so a `$schema` key makes it reject the whole document
 * and exit 1 with empty stdout — before the model is ever called. Codex reads
 * the schema file directly and wants `$schema`, so strip it only on this path.
 */
export function claudeJsonSchema(rawSchema) {
  const schema = JSON.parse(rawSchema);
  delete schema.$schema;
  return JSON.stringify(schema);
}

/** A failure the operator can act on; agentDraft forwards these unchanged
 *  instead of collapsing them into "没有返回结构化结果". */
export function agentDetailError(message) {
  return Object.assign(new Error(message), { agentDetail: true });
}

/** The CLI prints diagnostics (`[claude-code:unrecognized_model] {...}`) before
 *  the result envelope, so scan back for the last line that is a JSON object
 *  rather than slicing from the first `{` to the last `}`. */
export function parseClaudeEnvelope(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const lines = text.split("\n");
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index].trim();
      if (!line.startsWith("{")) continue;
      try {
        return JSON.parse(line);
      } catch {
        // Keep scanning: earlier lines may hold the real envelope.
      }
    }
    return null;
  }
}

export function parseClaudeDraft(stdout) {
  const payload = parseClaudeEnvelope(stdout);
  if (!payload) throw new Error("Claude 没有返回 JSON");
  // `--output-format json` reports auth, model and quota failures inside an
  // envelope that still exits 0, so surface the CLI's own message.
  if (payload.is_error) {
    const detail = String(payload.result || payload.error || "").replace(/\s+/g, " ").trim();
    throw agentDetailError(detail ? `Claude Code：${detail.slice(0, 180)}` : "Claude Code 运行失败，未给出原因");
  }
  // `structured_output` is the schema-validated object; `result` is the same
  // content as a string and can carry prose around it, so prefer the object.
  const result = payload.structured_output ?? payload.result ?? payload;
  if (typeof result === "string") {
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude 没有返回 JSON");
    return JSON.parse(match[0]);
  }
  if (result && typeof result === "object" && (result.name || result.slug || result.verdict)) return result;
  throw agentDetailError("Claude Code 返回的内容不符合收录结构，可能是当前模型不支持 --json-schema 结构化输出");
}

// Turn raw CLI failures into a reason the operator can act on: usage limits,
// login state, missing binary, or the first ERROR line of the log.
export function describeAgentFailure(message, toolLabel) {
  const text = String(message || "");
  const reset = text.match(/try again at (\d{1,2}:\d{2}\s*[AP]M)/i);
  if (/usage limit|hit your usage/i.test(text)) return `${toolLabel} 额度已用尽${reset ? `，${reset[1]} 后重置` : ""}`;
  if (/not logged in|unauthorized|invalid api key/i.test(text)) return `${toolLabel} 未登录或凭证失效`;
  if (/ENOENT|command not found/i.test(text)) return `${toolLabel} 命令不存在或不在 PATH`;
  const structuredMessage = text.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (structuredMessage) {
    const detail = structuredMessage[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
    return `${toolLabel} 请求失败：${detail.slice(0, 180)}`;
  }
  const lines = text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line
      && !/^\d{4}-\d{2}-\d{2}T/.test(line)
      && !/codex_models_manager/.test(line)
      && !line.startsWith("[claude-code:"));
  // Whatever the tool actually said beats a canned phrase: "没有返回结构化结果"
  // told the operator nothing and hid the real reason (a blocked fetch, a bad
  // flag, a proxy timeout). Only a completely silent tool has no detail left.
  const detail = lines.find((line) => /^error/i.test(line)) || lines[0] || "";
  return detail ? detail.slice(0, 160) : `${toolLabel} 没有输出任何内容`;
}

const TOOL_LABEL = { WebFetch: "读取页面", Read: "读取文件", Glob: "查找文件", Grep: "搜索内容", StructuredOutput: "整理成结构化草稿" };

function firstSentence(text, max = 90) {
  const line = String(text || "").replace(/\s+/g, " ").trim();
  if (!line) return "";
  // CJK sentences carry no space after the stop, so only ASCII stops need one.
  const stop = line.search(/[。！？]|[.!?](\s|$)/);
  const cut = stop > 0 ? line.slice(0, stop + 1) : line;
  return cut.length > max ? `${cut.slice(0, max)}…` : cut;
}

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return String(value || "").slice(0, 60);
  }
}

/**
 * Turn one Claude Code `stream-json` line into something worth showing while
 * the operator waits. Returns null for lines that carry no status (the final
 * result envelope, and anything unrecognised), so the caller can ignore them.
 * `tokens` updates arrive ~1000 times per run and must be throttled by the
 * caller rather than emitted as-is.
 */
export function claudeStreamStatus(event) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "system") {
    if (event.subtype === "init") return { kind: "status", text: "Claude Code 已启动" };
    if (event.subtype === "task_summary" && event.detail) {
      // Worded exactly like the matching tool_use line so the caller's
      // consecutive-duplicate check collapses the pair into one step.
      const fetching = String(event.detail).match(/^Fetching\s+(\S+)/i);
      return { kind: "status", text: fetching ? `${TOOL_LABEL.WebFetch} · ${hostOf(fetching[1])}` : firstSentence(event.detail) };
    }
    if (event.subtype === "thinking_tokens") return { kind: "tokens", tokens: Number(event.estimated_tokens) || 0 };
    return null;
  }
  if (event.type === "assistant") {
    for (const block of event.message?.content || []) {
      if (block.type === "tool_use") {
        const label = TOOL_LABEL[block.name] || block.name;
        const url = block.input?.url;
        return { kind: "status", text: url ? `${label} · ${hostOf(url)}` : label };
      }
      if (block.type === "thinking" && block.thinking) return { kind: "thinking", text: firstSentence(block.thinking) };
      if (block.type === "text" && block.text) {
        // A model that writes the draft as prose dumps raw JSON here; that is a
        // result, not a thought worth reading while waiting.
        const text = String(block.text).trim();
        if (text.startsWith("{") || text.startsWith("[") || text.startsWith("```")) return { kind: "status", text: "正在写出结果" };
        return { kind: "thinking", text: firstSentence(text) };
      }
    }
    return null;
  }
  if (event.type === "user") {
    const done = (event.message?.content || []).some((block) => block.type === "tool_result");
    return done ? { kind: "status", text: "工具已返回，继续整理" } : null;
  }
  return null;
}

/** Codex narrates on stdout; pick its latest readable line as a status, and
 *  skip JSON blobs, timestamps and banner noise. */
export function codexProgressLine(chunk) {
  const lines = String(chunk || "").split("\n").map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("{") || line.startsWith("[") || /^\d{4}-\d{2}-\d{2}T/.test(line)) continue;
    if (/^-{3,}$/.test(line) || /codex_models_manager/.test(line)) continue;
    return line.length > 90 ? `${line.slice(0, 90)}…` : line;
  }
  return "";
}
