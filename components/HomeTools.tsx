"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ToolList } from "@/components/ToolList";
import { ToolLogo } from "@/components/ToolLogo";
import { SiteDialog } from "@/components/SiteDialog";
import { ui } from "@/lib/i18n";
import type { PublicContentDocument } from "@/lib/public-content";
import { categoriesForBlock, categoryOf, tagLabel } from "@/lib/tags";
import { text, type Locale, type Tool } from "@/lib/types";

type PublicBoard = "tool" | "site" | "skill" | "project" | "prompt";

function boardFromLocation(): PublicBoard {
  const kind = new URLSearchParams(window.location.search).get("kind");
  return kind === "site" || kind === "skill" || kind === "project" || kind === "prompt" ? kind : "tool";
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

/**
 * 站点目录：与工具栏（ToolList）完全一致的 4 列瑞士目录排版，点击呼出 SiteDialog 预览弹窗
 */
function SiteDirectory({
  items,
  locale,
  onSelectSite,
}: {
  items: PublicContentDocument[];
  locale: Locale;
  onSelectSite: (site: PublicContentDocument) => void;
}) {
  const groups = useMemo(() => {
    const known = categoriesForBlock("site").map((category) => ({
      id: category.id,
      label: category.label[locale],
      items: items.filter((item) => categoryOf(item, "site") === category.id),
    })).filter((group) => group.items.length);
    const uncategorized = items.filter((item) => !categoryOf(item, "site"));
    return uncategorized.length
      ? [...known, { id: "uncategorized", label: locale === "zh" ? "未分类" : "Other", items: uncategorized }]
      : known;
  }, [locale, items]);

  return (
    <div className="tool-directory">
      {groups.map((group) => (
        <section
          key={group.id}
          className={`tool-directory-group${group.id === "uncategorized" ? " tool-directory-group--wide" : ""}`}
          aria-labelledby={`site-group-${group.id}`}
        >
          <header className="tool-directory-heading">
            <h3 id={`site-group-${group.id}`}>{group.label}</h3>
            <span>{group.items.length}</span>
          </header>
          <div className="tool-directory-list">
            {group.items.map((site) => (
              <button
                key={site.id}
                type="button"
                className="tool-directory-row"
                onClick={() => onSelectSite(site)}
              >
                <span className="tool-directory-logo">
                  <ToolLogo
                    tool={{
                      id: site.id,
                      name: site.title,
                      logo: site.logo,
                    }}
                    size={20}
                  />
                </span>
                <span className="tool-directory-name">{site.title}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * 技能与开源项目专属展示：支持方案 A（紧凑清单行）与方案 B（紧凑微型卡片）无缝切换
 */
function TechnicalLedger({
  items,
  locale,
}: {
  items: PublicContentDocument[];
  locale: Locale;
}) {
  const block = items[0]?.blockType;
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    if (!block) return [];
    const known = categoriesForBlock(block).map((category) => ({
      id: category.id,
      label: category.label[locale],
      count: items.filter((item) => categoryOf(item, block) === category.id).length,
    })).filter((cat) => cat.count > 0);
    const uncategorizedCount = items.filter((item) => !categoryOf(item, block)).length;
    if (uncategorizedCount > 0) {
      known.push({
        id: "uncategorized",
        label: locale === "zh" ? "未分类" : "Other",
        count: uncategorizedCount,
      });
    }
    return known;
  }, [block, locale, items]);

  const visibleItems = useMemo(() => {
    if (!block || activeCategory === "all") return items;
    if (activeCategory === "uncategorized") return items.filter((item) => !categoryOf(item, block));
    return items.filter((item) => categoryOf(item, block) === activeCategory);
  }, [block, items, activeCategory]);

  if (!block) return <CatalogEmpty locale={locale} />;

  return (
    <div className="tech-workbench">
      <div className="tech-toolbar">
        <div className="tech-filter-tabs" role="tablist" aria-label={locale === "zh" ? "分类筛选" : "Categories"}>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === "all"}
            className={`tech-filter-tab${activeCategory === "all" ? " is-active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            <span>{locale === "zh" ? "全部" : "All"}</span>
            <em>{items.length}</em>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.id}
              className={`tech-filter-tab${activeCategory === cat.id ? " is-active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span>{cat.label}</span>
              <em>{cat.count}</em>
            </button>
          ))}
        </div>

        <div className="tech-view-switcher" role="group" aria-label={locale === "zh" ? "视图切换" : "View mode"}>
          <button
            type="button"
            className={`tech-view-btn${viewMode === "grid" ? " is-active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setViewMode("grid");
            }}
            title={locale === "zh" ? "卡片视图" : "Grid View"}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
            </svg>
            <span>{locale === "zh" ? "卡片" : "Cards"}</span>
          </button>
          <button
            type="button"
            className={`tech-view-btn${viewMode === "list" ? " is-active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setViewMode("list");
            }}
            title={locale === "zh" ? "清单列表" : "List View"}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M2 3.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm0 4.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5zm0 4.5a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z" />
            </svg>
            <span>{locale === "zh" ? "清单" : "List"}</span>
          </button>
        </div>
      </div>

      <div className="tech-view-container" data-view={viewMode}>
        <div key={viewMode} className="tech-view-panel">
          {viewMode === "list" ? (
            <div className="tech-list">
              {visibleItems.map((item) => {
                const cat = categories.find((c) => c.id === categoryOf(item, block));
                const catLabel = cat ? cat.label : (locale === "zh" ? "项目" : "Project");

                return (
                  <Link
                    key={item.id}
                    href={`/${locale}/${item.blockType}s/${item.slug}/`}
                    className="tech-list-row"
                  >
                    <div className="tech-list-lead">
                      <span className="tech-card-logo">
                        <ToolLogo
                          tool={{
                            id: item.id,
                            name: item.title,
                            logo: item.logo,
                          }}
                          size={20}
                        />
                      </span>
                      <h4 className="tech-list-title">{item.title}</h4>
                      <span className="tech-list-category">{catLabel}</span>
                    </div>
                    <p className="tech-list-summary">{text(item.summary, locale)}</p>
                    <div className="tech-list-meta">
                      <span className="tech-list-arrow" aria-hidden="true">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="tech-grid-compact">
              {visibleItems.map((item) => {
                const cat = categories.find((c) => c.id === categoryOf(item, block));
                const catLabel = cat ? cat.label : (locale === "zh" ? "项目" : "Project");

                return (
                  <Link
                    key={item.id}
                    href={`/${locale}/${item.blockType}s/${item.slug}/`}
                    className="tech-card-compact"
                  >
                    <div className="tech-card-header">
                      <div className="tech-card-identity">
                        <span className="tech-card-logo">
                          <ToolLogo
                            tool={{
                              id: item.id,
                              name: item.title,
                              logo: item.logo,
                            }}
                            size={22}
                          />
                        </span>
                        <h4 className="tech-card-title">{item.title}</h4>
                      </div>
                      <span className="tech-card-category">{catLabel}</span>
                    </div>
                    <p className="tech-card-summary">{text(item.summary, locale)}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 提示词专属展台：配方卡（Recipe Card），内嵌等宽代码视窗与一键复制按钮
 */
function PromptShowcase({
  items,
  locale,
}: {
  items: PublicContentDocument[];
  locale: Locale;
}) {
  const groups = useMemo(() => {
    const known = categoriesForBlock("prompt").map((category) => ({
      id: category.id,
      label: category.label[locale],
      items: items.filter((item) => categoryOf(item, "prompt") === category.id),
    })).filter((group) => group.items.length);
    const uncategorized = items.filter((item) => !categoryOf(item, "prompt"));
    return uncategorized.length
      ? [...known, { id: "uncategorized", label: locale === "zh" ? "未分类" : "Other", items: uncategorized }]
      : known;
  }, [locale, items]);

  return (
    <div className="prompt-showcase">
      {groups.map((group) => (
        <section
          key={group.id}
          className="prompt-showcase-group"
          aria-labelledby={`prompt-group-${group.id}`}
        >
          <header className="prompt-showcase-heading">
            <h3 id={`prompt-group-${group.id}`}>{group.label}</h3>
            <span>{group.items.length}</span>
          </header>
          <div className="prompt-showcase-grid">
            {group.items.map((item) => {
              const cleanPrompt = (item.prompt || "")
                .replace(/^完整提示词[:：]?\s*/i, "")
                .replace(/^```[\w-]*\s*/, "")
                .replace(/```$/, "")
                .trim();
              const snippet = cleanPrompt.length > 200 ? `${cleanPrompt.slice(0, 200)}...` : cleanPrompt;

              return (
                <div key={item.id} className="prompt-recipe-card">
                  <div className="prompt-card-top">
                    <div className="prompt-card-header-left">
                      <span className="prompt-card-category">{group.label}</span>
                      <h4 className="prompt-card-title">
                        <Link href={`/${locale}/prompts/${item.slug}/`}>
                          {item.title}
                        </Link>
                      </h4>
                    </div>
                    {item.prompt ? (
                      <CopyPromptButton
                        value={item.prompt}
                        locale={locale}
                        className="prompt-card-copy-btn"
                      />
                    ) : null}
                  </div>
                  <p className="prompt-card-summary">{text(item.summary, locale)}</p>
                  {snippet ? (
                    <div className="prompt-card-window">
                      <div className="prompt-window-chrome">
                        <span className="prompt-dot" />
                        <span className="prompt-dot" />
                        <span className="prompt-dot" />
                        <span className="prompt-window-label">prompt.txt</span>
                      </div>
                      <pre className="prompt-window-content">
                        <code>{snippet}</code>
                      </pre>
                    </div>
                  ) : null}
                  <div className="prompt-card-foot">
                    <div className="prompt-card-tags">
                      {item.tags.map((tag) => (
                        <span key={tag} className="prompt-tag-badge">
                          #{tagLabel(tag, locale)}
                        </span>
                      ))}
                    </div>
                    <Link
                      href={`/${locale}/prompts/${item.slug}/`}
                      className="prompt-card-link"
                    >
                      <span>{locale === "zh" ? "完整参数与示例" : "Full prompt & examples"}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomeTools({
  all,
  content,
  locale,
}: {
  all: Tool[];
  content: PublicContentDocument[];
  locale: Locale;
}) {
  const t = ui(locale);
  const kinds: Array<{ kind: PublicBoard; label: string }> = [
    { kind: "tool", label: t.kindTool },
    { kind: "site", label: t.kindSite },
    { kind: "skill", label: t.kindSkill },
    { kind: "project", label: t.kindOpenSource },
    { kind: "prompt", label: t.kindPrompt },
  ];
  const [activeKind, setActiveKind] = useState<PublicBoard>("tool");
  const [selectedSite, setSelectedSite] = useState<PublicContentDocument | null>(null);
  const { barRef: kindBarRef, pillRef: kindPillRef } = useSlidingPill(activeKind);
  useRovingKeys(kindBarRef);

  useEffect(() => {
    const restoreBoard = () => {
      setActiveKind(boardFromLocation());
    };
    restoreBoard();
    window.addEventListener("popstate", restoreBoard);
    return () => window.removeEventListener("popstate", restoreBoard);
  }, []);

  function selectKind(kind: PublicBoard) {
    setActiveKind(kind);
    const url = new URL(window.location.href);
    url.searchParams.set("kind", kind);
    url.searchParams.delete("category");
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
            ) : activeKind === "site" ? (
              boardContent.length ? (
                <SiteDirectory items={boardContent} locale={locale} onSelectSite={setSelectedSite} />
              ) : (
                <CatalogEmpty locale={locale} />
              )
            ) : activeKind === "skill" || activeKind === "project" ? (
              boardContent.length ? (
                <TechnicalLedger items={boardContent} locale={locale} />
              ) : (
                <CatalogEmpty locale={locale} />
              )
            ) : activeKind === "prompt" ? (
              boardContent.length ? (
                <PromptShowcase items={boardContent} locale={locale} />
              ) : (
                <CatalogEmpty locale={locale} />
              )
            ) : (
              <CatalogEmpty locale={locale} />
            )}
          </div>
        </div>
      </div>
      <SiteDialog site={selectedSite} locale={locale} onClose={() => setSelectedSite(null)} />
    </section>
  );
}
