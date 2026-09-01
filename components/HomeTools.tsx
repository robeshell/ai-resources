"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ToolList } from "@/components/ToolList";
import { ui } from "@/lib/i18n";
import type { PublicContentSummary } from "@/lib/public-content";
import { text, type Locale, type Tool } from "@/lib/types";

type PublicBoard = "tool" | "skill" | "project" | "prompt";

function boardFromLocation(): PublicBoard {
  const kind = new URLSearchParams(window.location.search).get("kind");
  return kind === "skill" || kind === "project" || kind === "prompt" ? kind : "tool";
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
  const { barRef: kindBarRef, pillRef: kindPillRef } = useSlidingPill(activeKind);
  useRovingKeys(kindBarRef);

  useEffect(() => {
    const restoreBoard = () => setActiveKind(boardFromLocation());
    restoreBoard();
    window.addEventListener("popstate", restoreBoard);
    return () => window.removeEventListener("popstate", restoreBoard);
  }, []);

  function selectKind(kind: PublicBoard) {
    setActiveKind(kind);
    const url = new URL(window.location.href);
    url.searchParams.set("kind", kind);
    url.hash = "catalog";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const boardTools = activeKind === "tool" ? all : [];
  const boardContent = content.filter((item) => item.blockType === activeKind);
  const selectedKind = kinds.find((item) => item.kind === activeKind) ?? kinds[0];

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
              <div className="public-content-grid">
                {boardContent.map((item) => (
                  <Link key={item.id} href={`/${locale}/${item.blockType}s/${item.slug}/`} className="public-content-card">
                    <span>{selectedKind.label}</span>
                    <h3>{item.title}</h3>
                    <p>{text(item.summary, locale)}</p>
                    <em>{t.readMore} →</em>
                  </Link>
                ))}
              </div>
            ) : (
              <CatalogEmpty locale={locale} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
