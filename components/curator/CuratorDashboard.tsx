"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABEL, KIND_LABEL, curatorRequest, type CatalogItem } from "@/lib/curator-client";

export function CuratorDashboard() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [inbox, setInbox] = useState(0);
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      curatorRequest<{ items: CatalogItem[] }>("/catalog"),
      curatorRequest<{ items: unknown[] }>("/inbox"),
      curatorRequest<{ updatedAt: string }>("/site"),
    ]).then(([catalog, models, site]) => {
      setItems(catalog.items || []);
      setInbox(models.items?.length || 0);
      setUpdatedAt(site.updatedAt || "");
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "无法读取目录"));
  }, []);

  const active = items.filter((item) => item.status !== "archived");
  const archived = items.length - active.length;
  const byCategory = useMemo(() => (
    (Object.keys(CATEGORY_LABEL) as Array<CatalogItem["category"]>).map((id) => ({
      id,
      label: CATEGORY_LABEL[id],
      count: active.filter((item) => item.category === id).length,
    }))
  ), [active]);

  return (
    <section className="curator-shell">
      <div className="curator-intro">
        <p className="curator-kicker">CURATOR / 总览</p>
        <h1>管理这份索引</h1>
        <p>收录、改文案、归档、预览。公开站仍然只读 JSON。</p>
      </div>
      {error ? <p className="curator-message">{error}</p> : null}
      <div className="curator-stats">
        <article><strong>{active.length}</strong><span>在架资源</span></article>
        <article><strong>{archived}</strong><span>已归档</span></article>
        <article><strong>{inbox}</strong><span>模型待转移</span></article>
        <article><strong>{updatedAt.replaceAll("-", ".") || "—"}</strong><span>最近写入</span></article>
      </div>
      <div className="curator-overview-grid">
        <section>
          <h2>使用场景</h2>
          <ul className="curator-count-list">
            {byCategory.map((row) => (
              <li key={row.id}>
                <span>{row.label}</span>
                <em>{row.count}</em>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>类型</h2>
          <ul className="curator-count-list">
            {(Object.keys(KIND_LABEL) as Array<CatalogItem["kind"]>).map((kind) => (
              <li key={kind}>
                <span>{KIND_LABEL[kind]}</span>
                <em>{active.filter((item) => (item.kind || "tool") === kind).length}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="curator-quick-links">
        <Link href="/curator/ingest/">收录一条 →</Link>
        <Link href="/curator/resources/">打开资源库 →</Link>
      </div>
    </section>
  );
}
