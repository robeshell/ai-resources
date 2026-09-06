"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useRovingKeys } from "@/components/Transitions";
import { ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export type PublicBoard = "tool" | "site" | "skill" | "project" | "prompt";

function boardFromLocation(): PublicBoard {
  const kind = new URLSearchParams(window.location.search).get("kind");
  return kind === "site" || kind === "skill" || kind === "project" || kind === "prompt" ? kind : "tool";
}

const CatalogContext = createContext<{
  activeKind: PublicBoard;
  selectKind: (kind: PublicBoard) => void;
} | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [activeKind, setActiveKind] = useState<PublicBoard>("tool");
  const pathname = usePathname();

  useEffect(() => {
    const restore = () => setActiveKind(boardFromLocation());
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [pathname]);

  function selectKind(kind: PublicBoard) {
    setActiveKind(kind);
    const url = new URL(window.location.href);
    url.searchParams.set("kind", kind);
    url.searchParams.delete("category");
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  return <CatalogContext.Provider value={{ activeKind, selectKind }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("Catalog components require CatalogProvider");
  return context;
}

export function CatalogNavigation({ locale }: { locale: Locale }) {
  const { activeKind, selectKind } = useCatalog();
  const barRef = useRef<HTMLElement>(null);
  useRovingKeys(barRef);
  const t = ui(locale);
  const kinds: Array<{ kind: PublicBoard; label: string }> = [
    { kind: "tool", label: t.kindTool },
    { kind: "site", label: t.kindSite },
    { kind: "skill", label: t.kindSkill },
    { kind: "project", label: t.kindOpenSource },
    { kind: "prompt", label: t.kindPrompt },
  ];

  return (
    <nav ref={barRef} className="catalog-navigation" role="tablist" aria-label={t.catalogKinds}>
      {kinds.map(({ kind, label }) => (
        <button
          key={kind}
          id={`catalog-tab-${kind}`}
          type="button"
          role="tab"
          aria-selected={activeKind === kind}
          aria-controls="catalog-panel"
          tabIndex={activeKind === kind ? 0 : -1}
          onClick={() => selectKind(kind)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
