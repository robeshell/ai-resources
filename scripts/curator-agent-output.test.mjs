import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { claudeJsonSchema, claudeStreamStatus, codexProgressLine, describeAgentFailure, parseClaudeDraft, parseClaudeEnvelope } from "./curator-agent-output.mjs";

const DRAFT = { name: "Claude", slug: "claude", verdict: { zh: "长任务", en: "Long work" } };

test("the result envelope is found even behind CLI diagnostics", () => {
  // The CLI prints its own JSON diagnostics first; slicing from the first "{"
  // to the last "}" would span both and fail to parse.
  const stdout = [
    '[claude-code:unrecognized_model] {"model":"qwen3.8-flash","query_source":"generate_session_title"}',
    JSON.stringify({ type: "result", is_error: false, result: DRAFT }),
  ].join("\n");
  assert.deepEqual(parseClaudeDraft(stdout), DRAFT);
});

test("a plain envelope still parses", () => {
  assert.deepEqual(parseClaudeDraft(JSON.stringify({ result: DRAFT })), DRAFT);
  assert.equal(parseClaudeEnvelope(""), null);
  assert.equal(parseClaudeEnvelope("not json at all"), null);
});

test("the model's own error is surfaced instead of a generic failure", () => {
  const stdout = JSON.stringify({
    type: "result",
    is_error: true,
    api_error_status: 401,
    result: "Failed to authenticate. API Error: 401 Invalid bearer token",
  });
  assert.throws(() => parseClaudeDraft(stdout), (error) => {
    assert.equal(error.agentDetail, true);
    assert.match(error.message, /401 Invalid bearer token/);
    return true;
  });
});

test("a well-formed reply that is not a draft says so specifically", () => {
  const stdout = JSON.stringify({ type: "result", is_error: false, result: { note: "我不确定" } });
  assert.throws(() => parseClaudeDraft(stdout), (error) => {
    assert.equal(error.agentDetail, true);
    assert.match(error.message, /json-schema/);
    return true;
  });
});

test("known CLI failures keep their actionable wording", () => {
  assert.match(describeAgentFailure("Error: Input must be provided either through stdin or as a prompt argument when using --print", "Claude Code"), /Input must be provided/);
  assert.match(describeAgentFailure("You have hit your usage limit, try again at 3:00 PM", "Claude Code"), /额度已用尽.*3:00 PM/);
  assert.match(describeAgentFailure("spawn claude ENOENT", "Claude Code"), /命令不存在/);
  assert.equal(describeAgentFailure("", "Claude Code"), "Claude Code 没有输出任何内容");
  // The canned phrase must never win over something the tool actually said.
  assert.equal(describeAgentFailure("fetch failed: connect ETIMEDOUT 140.82.121.4:443", "Claude Code"), "fetch failed: connect ETIMEDOUT 140.82.121.4:443");
  assert.equal(describeAgentFailure('[claude-code:unrecognized_model] {"model":"x"}\nclaude exited with 1', "Claude Code"), "claude exited with 1");
});

test("the schema-validated object wins over the string copy of it", () => {
  // Claude Code returns both: `structured_output` is the validated object and
  // `result` is the same content as text. Reading `result` first meant relying
  // on a regex over prose.
  const stdout = JSON.stringify({
    type: "result",
    is_error: false,
    structured_output: DRAFT,
    result: `这是我整理的结果：\n\`\`\`json\n${JSON.stringify(DRAFT)}\n\`\`\``,
  });
  assert.deepEqual(parseClaudeDraft(stdout), DRAFT);
});

test("the schema handed to Claude Code carries no $schema ref", () => {
  // With `$schema` present the CLI refuses the whole document ("no schema with
  // key or ref ...") and exits 1 with empty stdout, so every run failed before
  // the model was called. The file keeps `$schema` for Codex.
  const raw = readFileSync(new URL("./curator-output.schema.json", import.meta.url), "utf8");
  const shipped = JSON.parse(raw);
  const forClaude = JSON.parse(claudeJsonSchema(raw));
  assert.equal("$schema" in forClaude, false);
  assert.deepEqual(forClaude.required, shipped.required);
  assert.deepEqual(Object.keys(forClaude.properties), Object.keys(shipped.properties));
});

test("stream events become readable progress, and noise is dropped", () => {
  const status = (event) => claudeStreamStatus(event);
  assert.deepEqual(status({ type: "system", subtype: "init" }), { kind: "status", text: "Claude Code 已启动" });
  assert.deepEqual(
    status({ type: "system", subtype: "task_summary", detail: "Fetching https://github.com/anthropics/claude-code" }),
    // Same wording as the WebFetch tool_use line, so the pair collapses to one step.
    { kind: "status", text: "读取页面 · github.com" },
  );
  assert.deepEqual(status({ type: "system", subtype: "thinking_tokens", estimated_tokens: 42 }), { kind: "tokens", tokens: 42 });
  assert.deepEqual(
    status({ type: "assistant", message: { content: [{ type: "tool_use", name: "WebFetch", input: { url: "https://example.com/a" } }] } }),
    { kind: "status", text: "读取页面 · example.com" },
  );
  assert.match(
    status({ type: "assistant", message: { content: [{ type: "thinking", thinking: "先抓页面。然后按 schema 输出。" }] } }).text,
    /^先抓页面。$/,
  );
  // The final envelope is parsed elsewhere; unknown shapes must not crash.
  assert.equal(status({ type: "result", subtype: "success" }), null);
  assert.equal(status(null), null);
  assert.equal(status({ type: "assistant", message: { content: [] } }), null);
  // A raw draft dumped as prose is a result, not a readable thought.
  assert.deepEqual(
    status({ type: "assistant", message: { content: [{ type: "text", text: '{"name":"X"}' }] } }),
    { kind: "status", text: "正在写出结果" },
  );
});

test("codex progress skips JSON, timestamps and banners", () => {
  assert.equal(codexProgressLine("2026-08-30T10:00:00Z start\n正在读取页面\n"), "正在读取页面");
  assert.equal(codexProgressLine('{"a":1}\n----\n'), "");
  assert.equal(codexProgressLine(""), "");
  assert.equal(codexProgressLine("x".repeat(200)).length, 91);
});

test("a diagnostic line on stderr must not hide the failure in stdout", () => {
  // The CLI exits 1, writes only `[claude-code:…]` noise to stderr, and puts the
  // real reason in the result envelope on stdout. Reading stderr first turned
  // that into the useless "没有输出任何内容".
  const envelope = JSON.stringify({
    type: "result",
    is_error: true,
    result: "API Error: 400 Invalid content type: output_text.",
  });
  assert.throws(() => parseClaudeDraft(envelope), (error) => {
    assert.equal(error.agentDetail, true);
    assert.match(error.message, /Invalid content type: output_text/);
    return true;
  });
  assert.equal(describeAgentFailure('[claude-code:unrecognized_model] {"model":"x"}', "Claude Code"), "Claude Code 没有输出任何内容");
});
