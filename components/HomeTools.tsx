"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TextSwap, useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ToolList } from "@/components/ToolList";
import { resourcesLabel, ui } from "@/lib/i18n";
import { ATTRIBUTE_TAG_GROUPS, categoryOf, tagGroup, tagLabel, usedCategories, usedTags } from "@/lib/tags";
import type { PublicContentSummary } from "@/lib/public-content";
import { text, type Locale, type Tool } from "@/lib/types";

type PublicBoard = "tool" | "skill" | "project" | "prompt";

function boardFromLocation(): PublicBoard {
  const kind = new URLSearchParams(window.location.search).get("kind");
  return kind === "skill" || kind === "project" || kind === "prompt" ? kind : "tool";
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
    { kind: "prompt", label: t.kindPrompt },
  ];
  const [activeKind, setActiveKind] = useState<PublicBoard>("tool");
  const [activeCategory, setActiveCategory] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const { barRef: kindBarRef, pillRef: kindPillRef } = useSlidingPill(activeKind);
  useRovingKeys(kindBarRef);

  useEffect(() => {
    const restoreBoard = () => setActiveKind(boardFromLocation());
    restoreBoard();
    window.addEventListener("popstate", restoreBoard);
    return () => window.removeEventListener("popstate", restoreBoard);
  }, []);

  function toggleTag(tag: string) {
    setActiveTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  }

  function selectKind(kind: PublicBoard) {
    setActiveKind(kind);
    // Filters are per board: the tags that narrow tools rarely mean anything
    // on the prompts board, and a stale filter reads as an empty section.
    setActiveCategory("");
    setActiveTags([]);
    const url = new URL(window.location.href);
    url.searchParams.set("kind", kind);
    url.hash = "catalog";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const boardTools = activeKind === "tool" ? all : [];
  const boardContent = content.filter((item) => item.blockType === activeKind);
  // Only offer tags this board actually has, so no filter can return nothing.
  const boardItems = activeKind === "tool" ? boardTools : boardContent;
  const offeredCategories = usedCategories(boardItems);
  const offeredTags = usedTags(boardItems);
  const matches = (tags: string[] | undefined) => activeTags.every((tag) => (tags || []).includes(tag));
  const matchesCategory = (item: { category?: string; tags?: string[] }) => !activeCategory || categoryOf(item) === activeCategory;
  const visibleTools = boardTools.filter((tool) => matchesCategory(tool) && matches(tool.tags));
  const visibleContent = boardContent.filter((item) => matchesCategory(item) && matches(item.tags));
  const selectedKind = kinds.find((item) => item.kind === activeKind) ?? kinds[0];
  const count = activeKind === "tool" ? visibleTools.length : visibleContent.length;

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
          <header className="library-toolbar">
            <div className="library-title">
              <h2>
                <TextSwap value={selectedKind.label} />
              </h2>
              <span>
                <TextSwap value={resourcesLabel(locale, count)} />
              </span>
            </div>
            {offeredCategories.length || offeredTags.length ? (
              <div className="library-filters">
                {offeredCategories.length ? (
                  <div className="library-categories" role="group" aria-label={locale === "zh" ? "二级分类" : "Categories"}>
                    <span className="filter-label">{locale === "zh" ? "分类" : "Category"}</span>
                    <div className="category-options">
                      <button type="button" className="category-option" aria-pressed={!activeCategory} onClick={() => setActiveCategory("")}>
                        {locale === "zh" ? "全部" : "All"}
                      </button>
                      {offeredCategories.map((category) => (
                        <button key={category} type="button" className="category-option" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
                          {tagLabel(category, locale)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {offeredTags.length ? <div className="library-attributes" role="group" aria-label={t.filterTags}>
                  <span className="filter-label">{locale === "zh" ? "标签" : "Tags"}</span>
                  <div className="attribute-options">
                  {ATTRIBUTE_TAG_GROUPS.map((group) => {
                  const groupTags = offeredTags.filter((tag) => tagGroup(tag) === group.id);
                  if (!groupTags.length) return null;
                  return (
                    <span key={group.id} className="filter-group">
                      {groupTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="filter-tag"
                          aria-pressed={activeTags.includes(tag)}
                          onClick={() => toggleTag(tag)}
                        >
                          {tagLabel(tag, locale)}
                        </button>
                      ))}
                    </span>
                  );
                })}
                {activeTags.length ? (
                  <button type="button" className="filter-clear" onClick={() => setActiveTags([])}>{t.clearTags}</button>
                ) : null}
                  </div>
                </div> : null}
              </div>
            ) : null}
          </header>
          <div role="tabpanel" className="content-panel">
            {activeKind === "tool" ? <ToolList tools={visibleTools} locale={locale} showTags={false} /> : (
              <div className="public-content-grid">
                {visibleContent.map((item) => (
                  <Link key={item.id} href={`/${locale}/${item.blockType}s/${item.slug}/`} className="public-content-card">
                    <span>{selectedKind.label}</span>
                    <h3>{item.title}</h3>
                    <p>{text(item.summary, locale)}</p>
                    <em>{t.readMore} →</em>
                  </Link>
                ))}
                {!visibleContent.length ? <p className="public-content-empty">{t.empty}</p> : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
