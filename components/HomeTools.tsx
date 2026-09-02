"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ToolList } from "@/components/ToolList";
import { ui } from "@/lib/i18n";
import type { PublicContentSummary } from "@/lib/public-content";
import { categoriesForBlock, categoryOf } from "@/lib/tags";
import { text, type Locale, type Tool } from "@/lib/types";

type PublicBoard = "tool" | "skill" | "project" | "site" | "prompt";

function boardFromLocation(): PublicBoard {
  const kind = new URLSearchParams(window.location.search).get("kind");
  return kind === "skill" || kind === "project" || kind === "site" || kind === "prompt" ? kind : "tool";
}

function CatalogEmpty({ locale }: { locale: Locale }) {
  const t = ui(locale);
  return (
    <div className="catalog-empty">
      <span className="catalog-empty-mark" aria-hidden="true">{locale === "zh" ? "空" : "–"}</span>
      <p className="catalog-empty-title">{t.emptyTitle}</p>
      <p className="catalog-empty-body">{t.empty}</p>
    </div>
  );
}

function ContentDirectory({ items, locale, activeCategory, onCategoryChange }: {
  items: PublicContentSummary[];
  locale: Locale;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  const t = ui(locale);
  const block = items[0]?.blockType;
  if (!block) return <CatalogEmpty locale={locale} />;
  const groups = categoriesForBlock(block).map((category) => ({
    id: category.id,
    label: category.label[locale],
    items: items.filter((item) => categoryOf(item, block) === category.id),
  })).filter((group) => group.items.length);
  const uncategorized = items.filter((item) => !categoryOf(item, block));
  if (uncategorized.length) groups.push({ id: "uncategorized", label: locale === "zh" ? "未分类" : "Other", items: uncategorized });
  const selectedCategory = groups.some((group) => group.id === activeCategory) ? activeCategory : "all";
  const visible = selectedCategory === "all" ? groups : groups.filter((group) => group.id === selectedCategory);

  return <div className="public-content-directory">
    <div className="public-category-filter" role="tablist" aria-label={locale === "zh" ? "二级分类" : "Categories"}>
      <button type="button" role="tab" aria-selected={selectedCategory === "all"} onClick={() => onCategoryChange("all")}>{locale === "zh" ? "全部" : "All"}<span>{items.length}</span></button>
      {groups.map((group) => <button key={group.id} type="button" role="tab" aria-selected={selectedCategory === group.id} onClick={() => onCategoryChange(group.id)}>{group.label}<span>{group.items.length}</span></button>)}
    </div>
    <div className="public-content-groups">
      {visible.map((group) => <section key={group.id} className="public-content-group" aria-labelledby={selectedCategory === "all" ? `content-group-${block}-${group.id}` : undefined} aria-label={selectedCategory === "all" ? undefined : group.label}>
        {selectedCategory === "all" ? <header><h3 id={`content-group-${block}-${group.id}`}>{group.label}</h3><span>{group.items.length}</span></header> : null}
        <div className="public-content-grid">
          {group.items.map((item) => (
            <Link key={item.id} href={`/${locale}/${item.blockType}s/${item.slug}/`} className="public-content-card">
              {item.logo?.startsWith("/") ? <div className="public-content-card-topline"><Image src={item.logo} alt="" width={28} height={28} unoptimized /></div> : null}
              <h3>{item.title}</h3>
              <p>{text(item.summary, locale)}</p>
              <em>{t.readMore} →</em>
            </Link>
          ))}
        </div>
      </section>)}
    </div>
  </div>;
}

export function HomeTools({
  all,
  content,
  locale,
}: {
  all: Tool[];
  content: PublicContentSummary[];
  locale: Locale;
}) {
  const t = ui(locale);
  const kinds: Array<{ kind: PublicBoard; label: string }> = [
    { kind: "tool", label: t.kindTool },
    { kind: "skill", label: t.kindSkill },
    { kind: "project", label: t.kindOpenSource },
    { kind: "site", label: t.kindSite },
    { kind: "prompt", label: t.kindPrompt },
  ];
  const [activeKind, setActiveKind] = useState<PublicBoard>("tool");
  const [activeCategory, setActiveCategory] = useState("all");
  const { barRef: kindBarRef, pillRef: kindPillRef } = useSlidingPill(activeKind);
  useRovingKeys(kindBarRef);

  useEffect(() => {
    const restoreBoard = () => {
      setActiveKind(boardFromLocation());
      setActiveCategory(new URLSearchParams(window.location.search).get("category") || "all");
    };
    restoreBoard();
    window.addEventListener("popstate", restoreBoard);
    return () => window.removeEventListener("popstate", restoreBoard);
  }, []);

  function selectKind(kind: PublicBoard) {
    setActiveKind(kind);
    setActiveCategory("all");
    const url = new URL(window.location.href);
    url.searchParams.set("kind", kind);
    url.searchParams.delete("category");
    url.hash = "catalog";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function selectCategory(category: string) {
    setActiveCategory(category);
    const url = new URL(window.location.href);
    if (category === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", category);
    url.hash = "catalog";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const boardTools = activeKind === "tool" ? all : [];
  const boardContent = content.filter((item) => item.blockType === activeKind);

  return (
    <section id="catalog" className="catalog-only" aria-label={t.catalogKinds}>
      <div className="library-shell">
        <aside className="scene-rail">
          <p>{t.catalogKinds}</p>
          <nav ref={kindBarRef} role="tablist" aria-label={t.catalogKinds}>
            <span ref={kindPillRef} className="t-tabs-pill" aria-hidden="true" />
            {kinds.map((item) => {
              const boardCount = item.kind === "tool" ? all.length : content.filter((entry) => entry.blockType === item.kind).length;
              return (
                <button
                  key={item.kind}
                  type="button"
                  role="tab"
                  aria-selected={activeKind === item.kind}
                  tabIndex={activeKind === item.kind ? 0 : -1}
                  onClick={() => selectKind(item.kind)}
                >
                  <span>{item.label}</span>
                  <em>{boardCount}</em>
                </button>
              );
            })}
          </nav>
        </aside>
        <div className="library-main">
          <div role="tabpanel" className="content-panel">
            {activeKind === "tool" ? (
              boardTools.length ? <ToolList tools={boardTools} locale={locale} /> : <CatalogEmpty locale={locale} />
            ) : boardContent.length ? (
              <ContentDirectory items={boardContent} locale={locale} activeCategory={activeCategory} onCategoryChange={selectCategory} />
            ) : (
              <CatalogEmpty locale={locale} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
