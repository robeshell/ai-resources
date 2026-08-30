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
  pricing: "free" | "freemium" | "paid" | "api";
  platforms: Array<"web" | "app" | "api" | "cli">;
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
  models: Array<{ id: string; label: string }>;
};

export type CuratorDraft = {
  name: string;
  slug: string;
  url: string;
  kind: CatalogItem["kind"] | "prompt";
  blockType?: CuratorIngestBlock;
  pricing: CatalogItem["pricing"];
  platforms: CatalogItem["platforms"];
  verdict: CatalogItem["verdict"];
  summary: CatalogItem["summary"];
  confidence: number;
  rationale: string;
  sourceLogoUrl?: string;
  body?: string;
  links?: ContentLink[];
  prompt?: string;
  variables?: PromptVariable[];
  examples?: PromptExample[];
};

export type CuratorRunPhase =
  | "fetch"
  | "extract"
  | "compare"
  | "generate"
  | "validate"
  | "asset"
  | "complete";

/** Chinese phase names shared by the ingest timeline and the Agent drawer. */
export const PHASE_LABEL: Record<CuratorRunPhase, string> = {
  fetch: "读取页面",
  extract: "提取信息",
  compare: "对照目录",
  generate: "生成草稿",
  validate: "检查内容",
  asset: "准备素材",
  complete: "完成",
};

export type CuratorRunEvent = {
  runId: string;
  sequence: number;
  timestamp: string;
  phase: CuratorRunPhase;
  type:
    | "phase.started"
    | "phase.progress"
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
  input?: { url: string; note: string; block?: "auto" | CuratorIngestBlock; mode?: "ingest" | "reprocess"; contentId?: string; tool?: AgentTool; model?: string };
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
