"use client";

import { useState } from "react";
import Link from "next/link";
import { TextSwap, useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ToolList } from "@/components/ToolList";
import { resourcesLabel, ui } from "@/lib/i18n";
import type { PublicContentSummary } from "@/lib/public-content";
import { text, type Locale, type Tool } from "@/lib/types";

type PublicBoard = "tool" | "skill" | "project" | "prompt";

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

  const visibleTools = activeKind === "tool" ? all : [];
  const visibleContent = content.filter((item) => item.blockType === activeKind);
  const selectedKind = kinds.find((item) => item.kind === activeKind) ?? kinds[0];
  const count = activeKind === "tool" ? all.length : visibleContent.length;

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
                  onClick={() => {
                    setActiveKind(item.kind);
                  }}
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
