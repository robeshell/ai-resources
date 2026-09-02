import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "@earendil-works/pi-agent-core";
import { Type, contentText } from "@earendil-works/pi-ai";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";

const EMPTY_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { ...EMPTY_COST, total: 0 },
};
const DEFAULT_CONTEXT_WINDOW = 128_000;
const DEFAULT_MAX_TOKENS = 8_192;
const anthropicStreams = anthropicMessagesApi();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PI_CONFIG_FILE = path.join(ROOT, ".curator", "pi-config.json");

function clean(value) {
  return String(value || "").trim();
}

/** Anthropic's SDK appends `/v1/messages` itself. Settings accept either the
 * gateway root or its `/v1` endpoint, so remove that suffix only at the SDK
 * boundary to avoid requests such as `/v1/v1/messages`. */
function anthropicSdkBaseUrl(value) {
  return clean(value).replace(/\/+$/, "").replace(/\/v1$/i, "");
}

function normalizeUsage(value) {
  return {
    input_tokens: Number(value?.input_tokens) || 0,
    output_tokens: Number(value?.output_tokens) || 0,
    cache_creation_input_tokens: Number(value?.cache_creation_input_tokens) || 0,
    cache_read_input_tokens: Number(value?.cache_read_input_tokens) || 0,
    ...(value || {}),
  };
}

/** Some compatible gateways omit usage on one of the Anthropic stream events.
 * Pi's adapter intentionally expects the official shape, so normalize only
 * those optional counters at the transport boundary. */
export function normalizeAnthropicSseLine(line) {
  if (!line.startsWith("data: ")) return line;
  try {
    const payload = JSON.parse(line.slice(6));
    if (payload.type === "message_start" && payload.message) {
      payload.message.usage = normalizeUsage(payload.message.usage);
    } else if (payload.type === "message_delta") {
      payload.usage = normalizeUsage(payload.usage);
    }
    return `data: ${JSON.stringify(payload)}`;
  } catch {
    return line;
  }
}

async function curatorGatewayFetch(input, init) {
  const response = await fetch(input, init);
  if (!response.body || !String(response.headers.get("content-type") || "").includes("text/event-stream")) return response;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const transformed = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) controller.enqueue(encoder.encode(`${normalizeAnthropicSseLine(line)}\n`));
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer) controller.enqueue(encoder.encode(normalizeAnthropicSseLine(buffer)));
    },
  }));
  return new Response(transformed, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

export async function readPiProjectConfig({ file = PI_CONFIG_FILE } = {}) {
  return readJson(file);
}

export function publicPiProjectConfig(config = {}) {
  const apiKey = clean(config.apiKey);
  return {
    configured: Boolean(clean(config.baseUrl) && apiKey && clean(config.defaultModel)),
    baseUrl: clean(config.baseUrl),
    defaultModel: clean(config.defaultModel),
    contextWindow: Number(config.contextWindow) || DEFAULT_CONTEXT_WINDOW,
    maxTokens: Number(config.maxTokens) || DEFAULT_MAX_TOKENS,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: apiKey ? `••••${apiKey.slice(-4)}` : "",
  };
}

export async function writePiProjectConfig(input, { file = PI_CONFIG_FILE } = {}) {
  const current = await readPiProjectConfig({ file });
  const baseUrl = clean(input.baseUrl).replace(/\/+$/, "");
  const apiKey = clean(input.apiKey) || clean(current.apiKey);
  const defaultModel = clean(input.defaultModel);
  const contextWindow = Number(input.contextWindow) || DEFAULT_CONTEXT_WINDOW;
  const maxTokens = Number(input.maxTokens) || DEFAULT_MAX_TOKENS;
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error("网关地址必须以 http:// 或 https:// 开头");
  if (!apiKey) throw new Error("请输入 API Key");
  if (!defaultModel) throw new Error("请输入默认模型名称");
  if (contextWindow < 1 || maxTokens < 1) throw new Error("Token 数必须大于 0");
  const next = { baseUrl, apiKey, defaultModel, contextWindow, maxTokens };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, file);
  await fs.chmod(file, 0o600);
  return next;
}

export async function deletePiProjectConfig({ file = PI_CONFIG_FILE } = {}) {
  await fs.rm(file, { force: true });
}

/** Resolve Pi only from Curator's project-local private configuration. */
export async function loadPiGatewayConfig({ selectedModel = "", file = PI_CONFIG_FILE, config: injectedConfig } = {}) {
  const settings = injectedConfig || await readPiProjectConfig({ file });
  const baseUrl = clean(settings.baseUrl).replace(/\/+$/, "");
  const apiKey = clean(settings.apiKey);
  const modelId = clean(selectedModel || settings.defaultModel);

  if (!baseUrl) throw new Error("Pi Agent 尚未配置网关地址，请前往系统页设置");
  if (!apiKey) throw new Error("Pi Agent 尚未配置 API Key，请前往系统页设置");
  if (!modelId) throw new Error("Pi Agent 尚未配置默认模型，请前往系统页设置");

  return {
    apiKey,
    requestedModel: modelId,
    model: {
      id: modelId,
      name: modelId,
      api: "anthropic-messages",
      provider: "curator-gateway",
      baseUrl: anthropicSdkBaseUrl(baseUrl),
      reasoning: true,
      input: ["text", "image"],
      cost: EMPTY_COST,
      contextWindow: Number(settings.contextWindow) || DEFAULT_CONTEXT_WINDOW,
      maxTokens: Number(settings.maxTokens) || DEFAULT_MAX_TOKENS,
      // Compatible gateways often reject Anthropic beta-only tool fields.
      compat: {
        supportsEagerToolInputStreaming: false,
        supportsLongCacheRetention: false,
        supportsCacheControlOnTools: false,
        supportsToolReferences: false,
        allowEmptySignature: true,
      },
    },
  };
}

function priorMessages(messages, model) {
  return (messages || [])
    .filter((message) => (message.role === "user" || message.role === "assistant") && clean(message.text))
    .slice(-20)
    .map((message) => {
      const timestamp = Date.parse(message.createdAt) || Date.now();
      if (message.role === "user") {
        return { role: "user", content: [{ type: "text", text: clean(message.text) }], timestamp };
      }
      // Persisted Curator messages only store display text. Rehydrate the
      // protocol metadata Pi requires when an assistant turn becomes context.
      return {
        role: "assistant",
        content: [{ type: "text", text: clean(message.text) }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: { ...EMPTY_USAGE, cost: { ...EMPTY_USAGE.cost } },
        stopReason: "stop",
        timestamp,
      };
    });
}

function systemPrompt(item) {
  const resource = item
    ? JSON.stringify({ id: item.id, title: item.title, blockType: item.blockType, category: item.category, tags: item.tags, sourceUrl: item.sourceUrl, payload: item.payload }, null, 2)
    : "当前对话尚未绑定资源。";
  return `你是 AI 资源集 Curator 工作台内置助手。你负责理解编辑意图，而不是把每句话都当成整理命令。

规则：
1. 普通提问、解释、讨论、确认和闲聊，直接简洁回答，禁止调用工具。
2. 只有用户当前这条消息明确要求重新整理、重新分析、重写多个字段、按来源全面更新时，才调用 reorganize_resource。不要从更早的消息推断授权；“好的”“可以”“继续”等确认词不构成整理指令。
3. 只改一个字段、询问某字段问题或表达不明确时，先回答或追问，不要触发全量整理。
4. 调用工具前，从用户原话提炼具体要求，不要自行扩大范围。
5. 不要声称已经保存、发布或修改数据库；整理结果仍需用户采用并保存。

当前资源：
${resource}`;
}

function explicitlyRequestsReorganization(text) {
  const value = clean(text);
  return /(?:重新|全面|整体|全部|从头|再)(?:整理|分析|更新|重写)/u.test(value)
    || /(?:整理|分析|更新|重写)(?:一遍|一下|下|这条|该资源|整条|全部)/u.test(value);
}

export async function runCuratorConversation({
  text,
  conversationMessages = [],
  item = null,
  conversationId,
  selectedModel = "",
  onEvent = () => {},
  onAgent = () => {},
  streamFn,
  model: injectedModel,
  apiKey: injectedApiKey,
} = {}) {
  const instruction = clean(text);
  if (!instruction) throw new Error("请输入消息");
  const canReorganize = explicitlyRequestsReorganization(instruction);

  const config = injectedModel
    ? { model: injectedModel, apiKey: injectedApiKey || "test-key", requestedModel: injectedModel.id }
    : await loadPiGatewayConfig({ selectedModel });
  let requestedReorganization = null;
  let answer = "";

  const reorganizeTool = {
    name: "reorganize_resource",
    label: "重新整理资源",
    description: "仅当用户明确要求全面重新整理或重新分析当前资源时调用。它只创建整理请求，不保存内容。",
    parameters: Type.Object({
      instruction: Type.String({ minLength: 1, maxLength: 2000, description: "保留用户要求边界的具体整理说明" }),
    }, { additionalProperties: false }),
    executionMode: "sequential",
    execute: async (_toolCallId, params) => {
      requestedReorganization = clean(params.instruction) || instruction;
      return {
        content: [{ type: "text", text: "已创建重新整理请求；接下来进入受控整理工作流，结果仍需人工采用和保存。" }],
        details: { instruction: requestedReorganization },
        terminate: true,
      };
    },
  };

  const agent = new Agent({
    streamFn: streamFn || ((model, context, options) => anthropicStreams.streamSimple(model, context, { ...options, fetch: curatorGatewayFetch })),
    sessionId: conversationId,
    getApiKey: () => config.apiKey,
    toolExecution: "sequential",
    initialState: {
      systemPrompt: systemPrompt(item),
      model: config.model,
      thinkingLevel: "low",
      // Tool availability is the authorization boundary. Conversation history
      // may inform the reply, but it can never turn a new acknowledgement or
      // aside into a fresh reorganization run.
      tools: item && canReorganize ? [reorganizeTool] : [],
      messages: priorMessages(conversationMessages, config.model),
    },
    convertToLlm: (messages) => messages.filter((message) => ["user", "assistant", "toolResult"].includes(message.role)),
  });
  onAgent(agent);

  agent.subscribe((event) => {
    if (event.type === "message_update") {
      const update = event.assistantMessageEvent;
      if (update.type === "text_delta") {
        answer += update.delta;
        onEvent({ type: "text.delta", text: update.delta });
      } else if (update.type === "thinking_delta") {
        onEvent({ type: "reasoning.delta", text: update.delta });
      }
    } else if (event.type === "tool_execution_start") {
      onEvent({ type: "tool.started", tool: event.toolName, args: event.args });
    } else if (event.type === "tool_execution_end") {
      onEvent({ type: "tool.completed", tool: event.toolName, isError: event.isError });
    }
  });

  await agent.prompt(instruction);
  const finalAssistant = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  if (finalAssistant?.stopReason === "error") {
    throw new Error(finalAssistant.errorMessage || "Pi Agent 请求模型失败");
  }
  if (finalAssistant?.stopReason === "aborted") {
    throw Object.assign(new Error("Pi Agent 已停止"), { cancelled: true });
  }
  answer = clean(answer || (finalAssistant ? contentText(finalAssistant.content) : ""));

  return {
    agent,
    model: config.model.id,
    requestedModel: config.requestedModel,
    action: requestedReorganization ? { type: "reorganize", instruction: requestedReorganization } : { type: "reply" },
    text: answer || (requestedReorganization ? "开始重新整理。" : "我没有生成有效回复，请重试。"),
  };
}

function decodeHtml(text) {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchReadablePage(url, fetchFn = fetch) {
  const target = new URL(url);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error("只允许读取 http 或 https 页面");
  const response = await fetchFn(target, {
    signal: AbortSignal.timeout(20_000),
    headers: { "User-Agent": "Mozilla/5.0 Curator/1.0" },
  });
  if (!response.ok) throw new Error(`读取失败：HTTP ${response.status}`);
  const raw = (await response.text()).slice(0, 300_000);
  const type = response.headers.get("content-type") || "";
  const text = type.includes("html") ? decodeHtml(raw) : raw.trim();
  return text.slice(0, 45_000) || "页面没有可读正文";
}

function gatewayToolUrl(baseUrl, name) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  return `${base}${base.endsWith("/v1") ? "" : "/v1"}/${name}`;
}

/** Run the complete ingest/reprocess workflow inside Pi. The model may read
 * pages and search, but the only mutation-like tool is submit_draft, which
 * merely returns a reviewable candidate to Curator. */
export async function runCuratorDraft({
  prompt,
  schema,
  selectedModel = "",
  conversationId,
  allowNetwork = true,
  onEvent = () => {},
  onAgent = () => {},
  streamFn,
  model: injectedModel,
  apiKey: injectedApiKey,
  fetchFn = fetch,
} = {}) {
  if (!clean(prompt)) throw new Error("整理提示词为空");
  const config = injectedModel
    ? { model: injectedModel, apiKey: injectedApiKey || "test-key", requestedModel: injectedModel.id }
    : await loadPiGatewayConfig({ selectedModel });
  let submittedDraft = null;
  let toolUses = 0;
  const maxNetworkUses = 4;
  const networkGuard = () => {
    toolUses += 1;
    if (toolUses > maxNetworkUses) throw new Error(`网页工具最多调用 ${maxNetworkUses} 次`);
  };

  const tools = [];
  if (allowNetwork) {
    tools.push({
      name: "web_fetch",
      label: "读取页面",
      description: "读取一个公开网页的正文。优先读取任务给出的目标 URL。",
      parameters: Type.Object({ url: Type.String({ minLength: 8 }) }, { additionalProperties: false }),
      executionMode: "sequential",
      execute: async (_id, params) => {
        networkGuard();
        const text = await fetchReadablePage(params.url, fetchFn);
        return { content: [{ type: "text", text }], details: { url: params.url } };
      },
    });
    tools.push({
      name: "web_search",
      label: "搜索网页",
      description: "仅在目标页面不足以核验关键事实时搜索网页；不要用搜索摘要代替目标页面证据。",
      parameters: Type.Object({ query: Type.String({ minLength: 2 }), max_results: Type.Optional(Type.Number({ minimum: 1, maximum: 5 })) }, { additionalProperties: false }),
      executionMode: "sequential",
      execute: async (_id, params) => {
        networkGuard();
        const response = await fetchFn(gatewayToolUrl(config.model.baseUrl, "web-search"), {
          method: "POST",
          signal: AbortSignal.timeout(25_000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ query: params.query, max_results: params.max_results || 5 }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || payload?.message || `搜索失败：HTTP ${response.status}`);
        return { content: [{ type: "text", text: JSON.stringify(payload.sources || payload, null, 2) }], details: { query: params.query } };
      },
    });
  }
  const submitDraftTool = {
    name: "submit_draft",
    label: "提交草稿",
    description: "完成核验后提交唯一的结构化草稿。提交后本轮结束，草稿仍需人工确认。",
    parameters: Type.Unsafe(Object.fromEntries(Object.entries(schema || {}).filter(([key]) => key !== "$schema"))),
    executionMode: "sequential",
    execute: async (_id, params) => {
      submittedDraft = params;
      return { content: [{ type: "text", text: "草稿已提交，等待人工确认。" }], details: { submitted: true }, terminate: true };
    },
  };
  tools.push(submitDraftTool);

  const baseStream = streamFn || ((model, context, options) => anthropicStreams.streamSimple(model, context, { ...options, fetch: curatorGatewayFetch }));
  let forceSubmission = false;
  const controlledStream = (model, context, options) => {
    return baseStream(model, context, {
      ...options,
      ...(forceSubmission ? {
        toolChoice: { type: "tool", name: "submit_draft" },
        // Anthropic-compatible APIs reject forced tool choice while extended
        // thinking is enabled. Research may think; deterministic submission
        // must not, because this turn only serializes the completed result.
        reasoning: undefined,
      } : {}),
    });
  };

  const agent = new Agent({
    streamFn: controlledStream,
    sessionId: conversationId,
    getApiKey: () => config.apiKey,
    toolExecution: "sequential",
    initialState: {
      systemPrompt: `你是 AI 资源集的整理 Agent。严格遵循用户提供的整理规则。${allowNetwork ? `先读取目标页面；必要时搜索。网页工具总计最多 ${maxNetworkUses} 次。` : "本轮禁止联网。"} 最终必须调用 submit_draft，禁止用普通文本或 Markdown 代替结构化提交。不要保存、发布或修改数据库。`,
      model: config.model,
      thinkingLevel: "low",
      tools,
      messages: [],
    },
    convertToLlm: (messages) => messages.filter((message) => ["user", "assistant", "toolResult"].includes(message.role)),
  });
  onAgent(agent);
  agent.subscribe((event) => {
    if (event.type === "message_update") {
      const update = event.assistantMessageEvent;
      // A draft run has no user-facing assistant reply. Compatible models may
      // narrate research or even print the pending article before they call
      // submit_draft; keep that text in the process stream so it cannot appear
      // as a chat message. Conversation runs still emit text.delta normally.
      if (update.type === "text_delta") onEvent({ type: "draft.delta", text: update.delta });
      else if (update.type === "thinking_delta") onEvent({ type: "reasoning.delta", text: update.delta });
    } else if (event.type === "tool_execution_start") {
      onEvent({ type: "tool.started", tool: event.toolName, args: event.args });
    } else if (event.type === "tool_execution_end") {
      onEvent({ type: "tool.completed", tool: event.toolName, isError: event.isError });
    }
  });

  await agent.prompt(clean(prompt));
  let finalAssistant = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
  if (finalAssistant?.stopReason === "error") throw new Error(finalAssistant.errorMessage || "Pi Agent 请求模型失败");
  if (finalAssistant?.stopReason === "aborted") throw Object.assign(new Error("Pi Agent 已停止"), { cancelled: true });
  if (!submittedDraft) {
    // Research and structured submission are different phases. Some compatible
    // models finish the research turn as plain text even when the prompt says
    // "must call". Narrow the next turn to one tool and force it at the API
    // level, preserving the complete research/tool history as context.
    onEvent({ type: "submission.started", tool: "submit_draft" });
    forceSubmission = true;
    agent.state.tools = [submitDraftTool];
    agent.state.thinkingLevel = "off";
    await agent.prompt("根据刚才已经完成的研究提交最终草稿。现在必须调用 submit_draft，不要继续解释。 ");
    finalAssistant = [...agent.state.messages].reverse().find((message) => message.role === "assistant");
    if (finalAssistant?.stopReason === "error") throw new Error(finalAssistant.errorMessage || "Pi Agent 结构化提交失败");
    if (finalAssistant?.stopReason === "aborted") throw Object.assign(new Error("Pi Agent 已停止"), { cancelled: true });
  }
  if (!submittedDraft) throw new Error("Pi Agent 没有提交结构化草稿");
  return { agent, draft: submittedDraft, model: config.model.id, requestedModel: config.requestedModel };
}
