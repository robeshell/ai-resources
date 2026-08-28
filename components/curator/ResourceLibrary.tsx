"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABEL, KIND_LABEL, curatorRequest, type CatalogItem } from "@/lib/curator-client";

const categories = Object.entries(CATEGORY_LABEL) as Array<[CatalogItem["category"], string]>;
const kinds = Object.entries(KIND_LABEL) as Array<[CatalogItem["kind"], string]>;
const platforms: CatalogItem["platforms"][number][] = ["web", "app", "api", "cli"];

export function ResourceLibrary() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<string>("active");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh(keepSlug?: string) {
    const payload = await curatorRequest<{ items: CatalogItem[] }>("/catalog");
    const next = payload.items || [];
    setItems(next);
    const current = keepSlug ? next.find((item) => item.slug === keepSlug) : null;
    setSelected(current || next.find((item) => item.status !== "archived") || next[0] || null);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : "无法读取资源"));
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    if (status !== "all" && (item.status || "active") !== status) return false;
    if (kind !== "all" && (item.kind || "tool") !== kind) return false;
    if (category !== "all" && item.category !== category) return false;
    if (query.trim()) {
      const haystack = `${item.name} ${item.slug} ${item.verdict.zh} ${item.verdict.en}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  }), [items, query, kind, category, status]);

  function update<K extends keyof CatalogItem>(key: K, value: CatalogItem[K]) {
    setSelected((current) => current ? { ...current, [key]: value } : current);
  }

  function updateLocalized(field: "verdict" | "summary", locale: "en" | "zh", value: string) {
    setSelected((current) => current ? {
      ...current,
      [field]: { ...current[field], [locale]: value },
    } : current);
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await curatorRequest<{ item: CatalogItem; message: string }>("/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: selected }),
      });
      setMessage(result.message);
      await refresh(result.item.slug);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function setItemStatus(next: "active" | "archived") {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await curatorRequest("/catalog/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selected.slug, status: next }),
      });
      await refresh(selected.slug);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="curator-shell curator-library">
      <div className="curator-intro">
        <p className="curator-kicker">CURATOR / 资源库</p>
        <h1>维护已收录的条目</h1>
        <p>改文案、场景和关联。归档等于从公开站下架。</p>
      </div>
      <div className="curator-library-layout">
        <aside>
          <div className="curator-library-filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或定位" />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="active">在架</option>
              <option value="archived">已归档</option>
              <option value="all">全部</option>
            </select>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="all">全部类型</option>
              {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">全部场景</option>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <ul className="curator-resource-list">
            {visible.map((item) => (
              <li key={item.id}>
                <button type="button" className={selected?.id === item.id ? "is-active" : undefined} onClick={() => setSelected(item)}>
                  <strong>{item.name}</strong>
                  <span>{KIND_LABEL[item.kind || "tool"]} · {CATEGORY_LABEL[item.category]}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {selected ? (
          <form className="curator-review" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <header className="curator-review-head">
              <div>
                <p>{selected.file === "resources" ? "resources.json" : "tools.json"} · {selected.slug}</p>
                <h2>{selected.name}</h2>
              </div>
              <a href={selected.url} target="_blank" rel="noreferrer">打开原链接 ↗</a>
            </header>
            <div className="curator-form-grid">
              <label>名称<input value={selected.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label>Slug<input value={selected.slug} onChange={(event) => update("slug", event.target.value)} /></label>
              <label>
                类型
                <select value={selected.kind || "tool"} onChange={(event) => update("kind", event.target.value as CatalogItem["kind"])}>
                  {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                场景
                <select value={selected.category} onChange={(event) => update("category", event.target.value as CatalogItem["category"])}>
                  {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>
                定价
                <select value={selected.pricing} onChange={(event) => update("pricing", event.target.value as CatalogItem["pricing"])}>
                  <option value="free">免费</option>
                  <option value="freemium">免费增值</option>
                  <option value="paid">付费</option>
                  <option value="api">按 API 用量</option>
                </select>
              </label>
              <label>链接<input value={selected.url} onChange={(event) => update("url", event.target.value)} /></label>
              <fieldset>
                <legend>平台</legend>
                <div className="curator-checks">
                  {platforms.map((platform) => (
                    <label key={platform}>
                      <input
                        type="checkbox"
                        checked={selected.platforms.includes(platform)}
                        onChange={() => {
                          const next = selected.platforms.includes(platform)
                            ? selected.platforms.filter((item) => item !== platform)
                            : [...selected.platforms, platform];
                          update("platforms", next);
                        }}
                      />
                      {platform.toUpperCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="is-wide">中文一句话定位<input value={selected.verdict.zh} onChange={(event) => updateLocalized("verdict", "zh", event.target.value)} /></label>
              <label className="is-wide">English verdict<input value={selected.verdict.en} onChange={(event) => updateLocalized("verdict", "en", event.target.value)} /></label>
              <label className="is-wide">中文简介<textarea rows={3} value={selected.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.target.value)} /></label>
              <label className="is-wide">English summary<textarea rows={3} value={selected.summary.en} onChange={(event) => updateLocalized("summary", "en", event.target.value)} /></label>
              <label className="is-wide">
                关联 Slug
                <input
                  value={selected.relatedSlugs.join(", ")}
                  onChange={(event) => update("relatedSlugs", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                />
              </label>
            </div>
            <footer className="curator-review-footer">
              <p>{selected.status === "archived" ? "这条已归档，公开站不会生成页面。" : "保存后点顶栏「生成预览」才能在首页看到。"}</p>
              <div className="curator-editor-actions">
                {selected.status === "archived" ? (
                  <button type="button" className="curator-secondary" onClick={() => setItemStatus("active")} disabled={busy}>恢复</button>
                ) : (
                  <button type="button" className="curator-secondary" onClick={() => setItemStatus("archived")} disabled={busy}>归档</button>
                )}
                <button type="submit" disabled={busy}>{busy ? "正在保存…" : "保存修改"}</button>
              </div>
            </footer>
            {message ? <p className="curator-message">{message}</p> : null}
          </form>
        ) : (
          <p className="curator-empty">没有匹配的资源。</p>
        )}
      </div>
    </section>
  );
}
