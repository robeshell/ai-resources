"use client";

import { useEffect, useState } from "react";
import { curatorRequest } from "@/lib/curator-client";

type InboxItem = {
  slug: string;
  name: string;
  url: string;
  category?: string;
  verdict?: { zh?: string; en?: string };
  queuedAt?: string;
};

export function InboxPanel() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [message, setMessage] = useState("");

  async function refresh() {
    const payload = await curatorRequest<{ items: InboxItem[] }>("/inbox");
    setItems(payload.items || []);
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error instanceof Error ? error.message : "无法读取清单"));
  }, []);

  async function dismiss(slug: string) {
    try {
      const payload = await curatorRequest<{ items: InboxItem[] }>("/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      setItems(payload.items || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法移除");
    }
  }

  return (
    <section className="curator-shell">
      <div className="curator-intro">
        <p className="curator-kicker">CURATOR / 模型清单</p>
        <h1>待转移到模型站</h1>
        <p>这里的条目不会出现在本站目录里。确认后交给 LLM 对比站处理。</p>
      </div>
      {message ? <p className="curator-message">{message}</p> : null}
      {items.length === 0 ? (
        <p className="curator-empty">清单是空的。</p>
      ) : (
        <ul className="curator-inbox-list">
          {items.map((item) => (
            <li key={item.slug}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.verdict?.zh || item.url}</span>
              </div>
              <div className="curator-editor-actions">
                <a href={item.url} target="_blank" rel="noreferrer">打开 ↗</a>
                <button type="button" className="curator-secondary" onClick={() => dismiss(item.slug)}>丢掉</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
