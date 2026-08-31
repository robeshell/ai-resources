import { contentBlocks, ENABLED_CONTENT_BLOCK_IDS, type ContentBlockId, type ContentItem, type ContentLink, type ContentPayloadByBlock, type PromptExample, type PromptVariable } from "./content-blocks";

const CURATOR_API = process.env.NEXT_PUBLIC_CURATOR_API_URL || "http://127.0.0.1:4317";

class CuratorError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "CuratorError";
    this.status = status;
    this.code = code;
  }
}

export async function curatorRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CURATOR_API}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = payload as { error?: string; code?: string };
    throw new CuratorError(body.error || `请求失败：${response.status}`, response.status, body.code);
  }
  return payload as T;
}

export type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo?: string;
  kind: "tool" | "skill" | "open-source";
  category: string;
  tags: string[];
  status: "active" | "archived";
  verdict: { en: string; zh: string };
  summary: { en: string; zh: string };
};

export type CuratorIngestBlock = "tool" | "skill" | "project" | "prompt";

export type CuratorContentItem = ContentItem<ContentPayloadByBlock[ContentBlockId]> & {
  revision?: {
    id: number;
    kind: "import" | "manual" | "ai_candidate";
    status: "current" | "candidate" | "superseded" | "abandoned";
    createdAt: string;
    note: string;
  };
};

export type BuildJob = {
  status: "idle" | "running" | "ok" | "error";
  log?: string;
  error?: string;
  publicUrl?: string;
};

export type AgentTool = "codex" | "claude";

export type AgentInfo = {
  id: AgentTool;
  label: string;
  available: boolean;
  defaultModel: string;
  /** `group` sorts the picker into 本地别名 / 网关模型 / 服务商目录. */
  models: Array<{ id: string; label: string; group?: string }>;
};

export type CuratorDraft = {
  name: string;
  slug: string;
  url: string;
  kind: CatalogItem["kind"] | "prompt";
  blockType?: CuratorIngestBlock;
  category: string;
  tags: string[];
  verdict: CatalogItem["verdict"];
  summary: CatalogItem["summary"];
  description?: CatalogItem["summary"];
  confidence: number;
  rationale: string;
  sourceLogoUrl?: string;
  body?: string;
  links?: ContentLink[];
  prompt?: string;
  variables?: PromptVariable[];
  examples?: PromptExample[];
};

export type CuratorRunPhase = "prepare" | "run" | "complete";

/** Chinese phase names shared by the ingest timeline and the Agent drawer.
 *  旧键（fetch/extract/…）用于回放历史运行的事件。 */
export const PHASE_LABEL: Record<CuratorRunPhase | "fetch" | "extract" | "compare" | "generate" | "validate" | "asset", string> = {
  prepare: "准备",
  run: "Agent 整理中",
  complete: "完成",
  fetch: "读取页面",
  extract: "提取信息",
  compare: "对照目录",
  generate: "生成草稿",
  validate: "检查内容",
  asset: "准备素材",
};

export type CuratorRunEvent = {
  runId: string;
  sequence: number;
  timestamp: string;
  phase: CuratorRunPhase;
  type:
    | "phase.started"
    | "phase.progress"
    | "agent.log"
    | "evidence.added"
    | "draft.patch"
    | "warning.added"
    | "tool.output"
    | "phase.completed"
    | "run.failed"
    | "run.cancelled"
    | "run.completed";
  level: "info" | "success" | "warning" | "error";
  message: string;
  data?: Record<string, unknown>;
};

export type CuratorRun = {
  id: string;
  status: "queued" | "running" | "awaiting_review" | "saved" | "failed" | "cancelled";
  phase: CuratorRunPhase;
  createdAt: string;
  updatedAt: string;
  input?: { url: string; note: string; block?: "auto" | CuratorIngestBlock; mode?: "ingest" | "reprocess"; contentId?: string; conversationId?: string; tool?: AgentTool; model?: string };
  draft?: CuratorDraft;
  source?: { title: string; description: string; finalUrl: string; logoUrl?: string };
  agent?: { mode: "codex" | "claude" | "rules"; tool?: AgentTool; model?: string; message?: string };
  error?: string;
  eventCount: number;
  candidateId?: number;
};

export type ActivityEntry = {
  at: string;
  type:
    | "resource.created"
    | "resource.saved"
    | "resource.archived"
    | "resource.restored"
    | "resource.deleted"
    | "logo.frozen"
    | "site.saved";
  message: string;
  slug?: string;
  name?: string;
};

export type ConversationMessageData = {
  runId?: string;
  status?: string;
  error?: string | null;
  tool?: string;
  draft?: CuratorDraft | null;
};

export type ConversationMessage = {
  id: number;
  role: "user" | "assistant";
  kind: string;
  text: string;
  data: ConversationMessageData | null;
  runId?: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  contentId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
};

// 与服务端 contentPayloadFromDraft 同规则：把运行草稿折算成条目 payload，
// 供会话结果「采用到编辑器」时做差量预览。
export function draftPayload(draft: CuratorDraft, current: Record<string, unknown>): Record<string, unknown> {
  // tags 是条目级字段，不在 payload 里；差量预览按一个扁平记录比对，
  // 采用时由编辑器再拆回去（见 ContentEditor 的 onAdopt）。
  const base: Record<string, unknown> = { ...current, ...(draft.category ? { category: draft.category } : {}), ...(draft.tags?.length ? { tags: draft.tags } : {}) };
  const block = draft.blockType || "tool";
  if (block === "tool") {
    return { ...base, ...(draft.sourceLogoUrl?.startsWith("/logos/") ? { logo: draft.sourceLogoUrl } : {}), tagline: draft.verdict, summary: draft.summary, ...(draft.description ? { description: draft.description } : {}), url: draft.url };
  }
  if (block === "prompt") {
    return { ...base, summary: draft.summary, prompt: (draft.prompt || "").trim(), variables: draft.variables || [], examples: draft.examples || [], links: draft.links?.length ? draft.links : base.links || [] };
  }
  return { ...base, summary: draft.summary, body: (draft.body || "").trim(), links: draft.links?.length ? draft.links : base.links || [] };
}

export type RunRecordStats = {
  count: number;
  bytes: number;
  oldest: string;
};

export type SaveResult = {
  target: string;
  destination?: "catalog" | "candidate";
  slug?: string;
  candidateId?: number;
  message: string;
  publicUrl?: string;
};

// Mirror of the server's describeAgentFailure: replays old tool.output
// events (whose stored message is the raw "退出码 N") as the real reason.
export function describeAgentFailure(message: string, toolLabel: string): string {
  const text = String(message || "");
  const reset = text.match(/try again at (\d{1,2}:\d{2}\s*[AP]M)/i);
  if (/usage limit|hit your usage/i.test(text)) return `${toolLabel} 额度已用尽${reset ? `，${reset[1]} 后重置` : ""}`;
  if (/not logged in|unauthorized|invalid api key/i.test(text)) return `${toolLabel} 未登录或凭证失效`;
  if (/ENOENT|command not found/i.test(text)) return `${toolLabel} 命令不存在或不在 PATH`;
  // Mirror of the server rule: show what the tool said, never a canned phrase.
  const lines = text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line
      && !/^\d{4}-\d{2}-\d{2}T/.test(line)
      && !/codex_models_manager/.test(line)
      && !line.startsWith("[claude-code:"));
  const detail = lines.find((line) => /^error/i.test(line)) || lines[0] || "";
  return detail ? detail.slice(0, 160) : `${toolLabel} 没有输出任何内容`;
}

export function agentEventMessage(event: { type: string; message: string; data?: Record<string, unknown> }): string {
  if (event.type !== "tool.output") return event.message;
  const data = (event.data || {}) as { command?: string; stdout?: string; stderr?: string };
  const toolLabel = data.command === "claude" ? "Claude Code" : "Codex";
  return describeAgentFailure(data.stderr || data.stdout || event.message, toolLabel);
}

export function curatorEventUrl(runId: string): string {
  return `${CURATOR_API}/runs/${encodeURIComponent(runId)}/events`;
}

export const KIND_LABEL: Record<CatalogItem["kind"], string> = {
  tool: "AI 产品",
  skill: "技能",
  "open-source": "开源项目",
};

/** Short block names shared by the library, the editor and the dashboard. */
export const BLOCK_LABELS: Record<CuratorIngestBlock, string> = {
  ...Object.fromEntries(ENABLED_CONTENT_BLOCK_IDS.map((id) => [id, contentBlocks[id].label.zh])),
} as Record<CuratorIngestBlock, string>;
