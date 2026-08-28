"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { curatorRequest } from "@/lib/curator-client";

type DraftKind = "tool" | "skill" | "open-source" | "model";
type Category = "code" | "chat" | "image" | "video" | "research" | "agents";
type Pricing = "free" | "freemium" | "paid" | "api";
type Platform = "web" | "app" | "api" | "cli";
type AgentTool = "codex" | "claude";

type Draft = {
  name: string;
  slug: string;
  url: string;
  kind: DraftKind;
  category: Category;
  pricing: Pricing;
  platforms: Platform[];
  verdict: { en: string; zh: string };
  summary: { en: string; zh: string };
  relatedSlugs: string[];
  confidence: number;
  rationale: string;
  sourceLogoUrl?: string;
};

type AgentInfo = {
  id: AgentTool;
  label: string;
  available: boolean;
  defaultModel: string;
  models: Array<{ id: string; label: string }>;
};

type AnalyzeResult = {
  draft: Draft;
  agent: { mode: "codex" | "claude" | "rules"; tool?: AgentTool; model?: string; message?: string };
  source: { title: string; description: string; finalUrl: string };
};

const TOOL_KEY = "ai-nav-curator-tool";
const modelKey = (tool: AgentTool) => `ai-nav-curator-model-${tool}`;
const categories: Array<{ value: Category; label: string }> = [
  { value: "code", label: "编程开发" },
  { value: "chat", label: "写作办公" },
  { value: "image", label: "图像设计" },
  { value: "video", label: "视频音频" },
  { value: "research", label: "搜索研究" },
  { value: "agents", label: "自动化" },
];
const kinds: Array<{ value: DraftKind; label: string }> = [
  { value: "tool", label: "AI 产品" },
  { value: "skill", label: "Skill" },
  { value: "open-source", label: "开源项目" },
  { value: "model", label: "模型" },
];
const platforms: Platform[] = ["web", "app", "api", "cli"];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return curatorRequest<T>(path, init);
}

function storedTool(): AgentTool {
  return localStorage.getItem(TOOL_KEY) === "claude" ? "claude" : "codex";
}

function storedModel(tool: AgentTool): string {
  return localStorage.getItem(modelKey(tool)) || "";
}

function agentHeadline(agent: AnalyzeResult["agent"] | null): string {
  if (!agent) return "草稿";
  if (agent.mode === "rules") return agent.message || "规则草稿";
  const name = agent.mode === "claude" ? "Claude Code" : "Codex";
  return agent.model ? `${name} · ${agent.model}` : name;
}

export function CuratorStudio() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [source, setSource] = useState<AnalyzeResult["source"] | null>(null);
  const [agentMode, setAgentMode] = useState<AnalyzeResult["agent"] | null>(null);
  const [tools, setTools] = useState<AgentInfo[]>([]);
  const [tool, setTool] = useState<AgentTool>("codex");
  const [model, setModel] = useState("");
  const [service, setService] = useState<"checking" | "online" | "offline">("checking");
  const [busy, setBusy] = useState<"analyze" | "save" | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");

  const currentTool = useMemo(
    () => tools.find((item) => item.id === tool) ?? tools[0],
    [tools, tool],
  );
  const models = currentTool?.models ?? [];

  useEffect(() => {
    request<{ ok: boolean; tools: AgentInfo[] }>("/health")
      .then((payload) => {
        setService("online");
        setTools(payload.tools || []);
        const preferred = storedTool();
        const available = (payload.tools || []).filter((item) => item.available);
        const nextTool = available.some((item) => item.id === preferred)
          ? preferred
          : available[0]?.id || "codex";
        setTool(nextTool);
        const nextModels = (payload.tools || []).find((item) => item.id === nextTool);
        setModel(storedModel(nextTool) || nextModels?.defaultModel || nextModels?.models[0]?.id || "");
      })
      .catch(() => setService("offline"));
  }, []);

  function chooseTool(next: AgentTool) {
    setTool(next);
    localStorage.setItem(TOOL_KEY, next);
    const info = tools.find((item) => item.id === next);
    const nextModel = storedModel(next) || info?.defaultModel || info?.models[0]?.id || "";
    setModel(nextModel);
  }

  function chooseModel(next: string) {
    setModel(next);
    localStorage.setItem(modelKey(tool), next);
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setBusy("analyze");
    setMessage("");
    setSaved(false);
    try {
      const result = await request<AnalyzeResult>("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, note, tool, model }),
      });
      setDraft(result.draft);
      setSource(result.source);
      setAgentMode(result.agent);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "链接分析失败");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setMessage("");
    try {
      const result = await request<{ target: string; message: string }>("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      setSaved(true);
      setMessage(`${result.message} · ${result.target}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  }

  function updateLocalized(key: "verdict" | "summary", locale: "en" | "zh", value: string) {
    setDraft((current) => current ? {
      ...current,
      [key]: { ...current[key], [locale]: value },
    } : current);
  }

  function togglePlatform(platform: Platform) {
    if (!draft) return;
    const next = draft.platforms.includes(platform)
      ? draft.platforms.filter((item) => item !== platform)
      : [...draft.platforms, platform];
    update("platforms", next);
  }

  const toolOffline = Boolean(currentTool) && !currentTool.available;

  return (
    <section className="curator-shell">
        <div className="curator-intro">
          <p className="curator-kicker">CURATOR / 收录</p>
          <h1>整理一条 AI 资源</h1>
          <p>选本机 Agent 和模型，粘贴链接，确认文案后写入数据。</p>
        </div>

        <form className="curator-composer" onSubmit={analyze}>
          <div className="curator-agent-row">
            <label>
              Agent
              <select value={tool} onChange={(event) => chooseTool(event.target.value as AgentTool)}>
                {tools.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.available}>
                    {item.label}{item.available ? "" : "（未安装）"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              模型
              {models.length ? (
                <select value={model} onChange={(event) => chooseModel(event.target.value)}>
                  <option value="">使用工具默认</option>
                  {models.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={model}
                  onChange={(event) => chooseModel(event.target.value)}
                  placeholder="从本机 Agent 读取，或手动填写"
                />
              )}
            </label>
          </div>
          <label htmlFor="curator-url">资源链接</label>
          <input
            id="curator-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/..."
            required
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="可选：告诉 Agent 你为什么想收录，或者希望它重点判断什么"
            rows={3}
          />
          <div className="curator-composer-footer">
            <span>{toolOffline ? `${currentTool?.label} 不在 PATH 里` : "模型条目会进入单独待转移清单"}</span>
            <button type="submit" disabled={busy !== null || service === "offline" || toolOffline}>
              {busy === "analyze" ? "正在阅读与分类…" : "分析链接"}
            </button>
          </div>
        </form>

        {service === "offline" ? (
          <div className="curator-notice">
            在项目目录运行 <code>npm run curator</code>，然后重新打开这个页面。
          </div>
        ) : null}

        {draft ? (
          <section className="curator-review" aria-labelledby="curator-review-title">
            <header className="curator-review-head">
              <div>
                <p>{agentHeadline(agentMode)} · 置信度 {Math.round(draft.confidence * 100)}%</p>
                <h2 id="curator-review-title">确认这条资源怎么归档</h2>
              </div>
              <a href={source?.finalUrl || draft.url} target="_blank" rel="noreferrer">打开原链接 ↗</a>
            </header>

            <div className="curator-source-line">
              <strong>{source?.title || draft.name}</strong>
              <span>{source?.description || "页面没有提供简介"}</span>
            </div>

            <div className="curator-form-grid">
              <label>
                名称
                <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
              </label>
              <label>
                Slug
                <input value={draft.slug} onChange={(event) => update("slug", event.target.value)} />
              </label>
              <label>
                资源类型
                <select value={draft.kind} onChange={(event) => update("kind", event.target.value as DraftKind)}>
                  {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                </select>
              </label>
              <label>
                使用场景
                <select value={draft.category} onChange={(event) => update("category", event.target.value as Category)}>
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </label>
              <label>
                定价
                <select value={draft.pricing} onChange={(event) => update("pricing", event.target.value as Pricing)}>
                  <option value="free">免费</option>
                  <option value="freemium">免费增值</option>
                  <option value="paid">付费</option>
                  <option value="api">按 API 用量</option>
                </select>
              </label>
              <fieldset>
                <legend>平台</legend>
                <div className="curator-checks">
                  {platforms.map((platform) => (
                    <label key={platform}>
                      <input type="checkbox" checked={draft.platforms.includes(platform)} onChange={() => togglePlatform(platform)} />
                      {platform.toUpperCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="is-wide">
                中文一句话定位
                <input value={draft.verdict.zh} onChange={(event) => updateLocalized("verdict", "zh", event.target.value)} />
              </label>
              <label className="is-wide">
                English verdict
                <input value={draft.verdict.en} onChange={(event) => updateLocalized("verdict", "en", event.target.value)} />
              </label>
              <label className="is-wide">
                中文简介
                <textarea rows={3} value={draft.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.target.value)} />
              </label>
              <label className="is-wide">
                English summary
                <textarea rows={3} value={draft.summary.en} onChange={(event) => updateLocalized("summary", "en", event.target.value)} />
              </label>
              <label className="is-wide">
                关联资源 Slug
                <input
                  value={draft.relatedSlugs.join(", ")}
                  onChange={(event) => update("relatedSlugs", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                  placeholder="cursor, claude-code"
                />
              </label>
            </div>

            <div className="curator-rationale">
              <span>为什么这样分</span>
              <p>{draft.rationale}</p>
            </div>

            <footer className="curator-review-footer">
              <p>{draft.kind === "model" ? "确认后写入模型待转移清单。" : "确认后写入站点 JSON。要在首页看到，再点生成预览。"}</p>
              <button type="button" onClick={save} disabled={busy !== null}>
                {busy === "save" ? "正在保存…" : draft.kind === "model" ? "加入模型清单" : "确认并加入站点"}
              </button>
            </footer>
          </section>
        ) : null}

        {saved ? <p className="curator-message">已入库。用顶栏「生成预览」查看公开站。</p> : null}
        {message ? <p className="curator-message" role="status">{message}</p> : null}
    </section>
  );
}
