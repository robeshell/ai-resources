"use client";

import { useEffect, useState } from "react";
import { curatorRequest } from "@/lib/curator-client";

type Scenario = {
  id: string;
  order: number;
  title: { en: string; zh: string };
  summary: { en: string; zh: string };
  outcome: { en: string; zh: string };
  resourceSlugs: string[];
};

export function ScenariosPanel() {
  const [items, setItems] = useState<Scenario[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    curatorRequest<{ items: Scenario[] }>("/scenarios")
      .then((payload) => setItems(payload.items || []))
      .catch((error) => setMessage(error instanceof Error ? error.message : "无法读取场景方案"));
  }, []);

  function update(index: number, next: Scenario) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? next : item));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const result = await curatorRequest<{ message: string }>("/scenarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="curator-shell">
      <div className="curator-intro">
        <p className="curator-kicker">CURATOR / 场景方案</p>
        <h1>编辑组合方案</h1>
        <p>V1 首页不展示这些，但数据还在，需要能改。</p>
      </div>
      {items.map((item, index) => (
        <article key={item.id} className="curator-review">
          <h2>{item.id}</h2>
          <div className="curator-form-grid">
            <label className="is-wide">中文标题<input value={item.title.zh} onChange={(event) => update(index, { ...item, title: { ...item.title, zh: event.target.value } })} /></label>
            <label className="is-wide">English title<input value={item.title.en} onChange={(event) => update(index, { ...item, title: { ...item.title, en: event.target.value } })} /></label>
            <label className="is-wide">中文说明<textarea rows={2} value={item.summary.zh} onChange={(event) => update(index, { ...item, summary: { ...item.summary, zh: event.target.value } })} /></label>
            <label className="is-wide">English summary<textarea rows={2} value={item.summary.en} onChange={(event) => update(index, { ...item, summary: { ...item.summary, en: event.target.value } })} /></label>
            <label className="is-wide">
              关联资源
              <input
                value={item.resourceSlugs.join(", ")}
                onChange={(event) => update(index, { ...item, resourceSlugs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
              />
            </label>
          </div>
        </article>
      ))}
      <footer className="curator-review-footer">
        <p>保存只改 JSON。首页仍不展示场景方案。</p>
        <button type="button" onClick={save} disabled={busy}>{busy ? "正在保存…" : "保存方案"}</button>
      </footer>
      {message ? <p className="curator-message">{message}</p> : null}
    </section>
  );
}
