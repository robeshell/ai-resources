export const CURATOR_API = process.env.NEXT_PUBLIC_CURATOR_API_URL || "http://127.0.0.1:4317";

export async function curatorRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CURATOR_API}${path}`, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { error?: string }).error || `请求失败：${response.status}`);
  return payload as T;
}

export type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo?: string;
  kind: "tool" | "skill" | "open-source";
  category: "code" | "chat" | "image" | "video" | "research" | "agents";
  pricing: "free" | "freemium" | "paid" | "api";
  platforms: Array<"web" | "app" | "api" | "cli">;
  featured: boolean;
  status: "active" | "archived";
  relatedModelIds: string[];
  relatedSlugs: string[];
  verdict: { en: string; zh: string };
  summary: { en: string; zh: string };
  file?: "tools" | "resources";
};

export type BuildJob = {
  status: "idle" | "running" | "ok" | "error";
  log?: string;
  error?: string;
  previewUrl?: string;
};

export const CATEGORY_LABEL: Record<CatalogItem["category"], string> = {
  code: "编程开发",
  chat: "写作办公",
  image: "图像设计",
  video: "视频音频",
  research: "搜索研究",
  agents: "自动化",
};

export const KIND_LABEL: Record<CatalogItem["kind"], string> = {
  tool: "AI 产品",
  skill: "Skill",
  "open-source": "开源项目",
};
