"use client";

import { useState } from "react";
import { ToolList } from "@/components/ToolList";
import { ui } from "@/lib/i18n";
import { text, type Category, type Locale, type ResourceKind, type Tool } from "@/lib/types";

export function HomeTools({
  all,
  categories,
  locale,
  rankingUrl,
}: {
  all: Tool[];
  categories: Category[];
  locale: Locale;
  rankingUrl: string;
}) {
  const t = ui(locale);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "chat");
  const [activeKind, setActiveKind] = useState<ResourceKind | undefined>(undefined);

  const groups: Array<{ id: string; kind: ResourceKind; label: string }> = [
    { id: "tools", kind: "tool", label: t.kindTool },
    { id: "skills", kind: "skill", label: t.kindSkill },
    { id: "open-source", kind: "open-source", label: t.kindOpenSource },
  ];
  const inScene = all.filter((resource) => resource.category === activeCategory);
  const visible = inScene.filter((resource) => !activeKind || (resource.kind ?? "tool") === activeKind);
  const modelUrl = `${rankingUrl.replace(/\/$/, "")}/models/`;
  const selectedCategory = categories.find((category) => category.id === activeCategory) ?? categories[0];

  return (
    <section id="catalog" className="catalog-only" aria-label={locale === "zh" ? "内容分类" : "Content categories"}>
      <div className="library-shell">
        <aside className="scene-rail">
          <p>{locale === "zh" ? "使用场景" : "Use cases"}</p>
          <nav role="tablist" aria-label={locale === "zh" ? "使用场景" : "Use cases"}>
            {categories.map((category) => {
              const count = all.filter((resource) => resource.category === category.id).length;
              return (
                <button key={category.id} type="button" role="tab" aria-selected={activeCategory === category.id} onClick={() => { setActiveCategory(category.id); setActiveKind(undefined); }}>
                  <span>{text(category.name, locale)}</span>
                  <em>{count}</em>
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="library-main">
          <header className="library-toolbar">
            <div className="library-title">
              <h2>{selectedCategory ? text(selectedCategory.name, locale) : ""}</h2>
              <span>{visible.length} {t.toolsLabel}</span>
            </div>
            <nav className="type-tabs" role="tablist" aria-label={locale === "zh" ? "资源类型" : "Resource types"}>
              <button type="button" role="tab" aria-selected={!activeKind} onClick={() => setActiveKind(undefined)}>{locale === "zh" ? "全部" : "All"}</button>
              {groups.map((group) => {
                const count = inScene.filter((resource) => (resource.kind ?? "tool") === group.kind).length;
                if (count === 0) return null;
                return <button key={group.id} type="button" role="tab" aria-selected={activeKind === group.kind} onClick={() => setActiveKind(group.kind)}>{group.label}</button>;
              })}
              <a href={modelUrl} target="_blank" rel="noreferrer">{locale === "zh" ? "模型 ↗" : "Models ↗"}</a>
            </nav>
          </header>
          <div role="tabpanel" className="content-panel">
            <ToolList tools={visible} locale={locale} showTags={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
