"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PromptCard } from "@/components/PromptCard";
import { useCatalog } from "@/components/CatalogNavigation";
import { ResourceDirectory } from "@/components/ResourceDirectory";
import { ResourceCard } from "@/components/ResourceCard";
import { ToolList } from "@/components/ToolList";
import { ToolLogo } from "@/components/ToolLogo";
import { SiteDialog } from "@/components/SiteDialog";
import { ui } from "@/lib/i18n";
import type { PublicContentDocument } from "@/lib/public-content";
import { categoriesForBlock, categoryOf } from "@/lib/tags";
import { text, type Locale, type Tool } from "@/lib/types";

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

function SiteDirectory({
  items, locale, onSelectSite,
}: {
  items: PublicContentDocument[];
  locale: Locale;
  onSelectSite: (site: PublicContentDocument) => void;
}) {
  return (
    <ResourceDirectory
      items={items.map((site) => ({ ...site, name: site.title }))}
      block="site"
      locale={locale}
      onSelect={onSelectSite}
    />
  );
}

/**
 * 技能与开源项目共用分类筛选、卡片和清单视图。
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
            aria-pressed={viewMode === "grid"}
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
            aria-pressed={viewMode === "list"}
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
                const catLabel = cat ? cat.label : (locale === "zh" ? "未分类" : "Other");

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
                const catLabel = cat ? cat.label : (locale === "zh" ? "未分类" : "Other");

                return (
                  <ResourceCard key={item.id} item={item} category={catLabel} locale={locale} />
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
 * 提示词按用途分组，卡片提供全文入口与直接复制。
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
            {group.items.map((item) => (
              <PromptCard key={item.id} item={item} locale={locale} />
            ))}
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
  const { activeKind } = useCatalog();
  const [selectedSite, setSelectedSite] = useState<PublicContentDocument | null>(null);

  const boardTools = activeKind === "tool" ? all : [];
  const boardContent = content.filter((item) => item.blockType === activeKind);

  return (
    <section id="catalog" className="catalog-only" aria-label={t.catalogKinds}>
      <div id="catalog-panel" role="tabpanel" aria-labelledby={`catalog-tab-${activeKind}`} tabIndex={0} className="content-panel">
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
                <TechnicalLedger key={activeKind} items={boardContent} locale={locale} />
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
      <SiteDialog site={selectedSite} locale={locale} onClose={() => setSelectedSite(null)} />
    </section>
  );
}
