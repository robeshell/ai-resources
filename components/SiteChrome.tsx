"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { loadSite } from "@/lib/data";
import { ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function SiteChrome({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = ui(locale);
  const site = loadSite();
  const pathname = usePathname() || `/${locale}`;

  return (
    <div className="min-h-full">
      <a href="#main" className="skip-link">
        {t.skip}
      </a>
      <SiteHeader
        locale={locale}
        pathname={pathname}
      />
      <main
        id="main"
        className="site-content mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12"
        style={{ scrollMarginTop: "var(--header-height)" }}
      >
        <ViewTransition
          key={pathname}
          enter={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          exit={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          default="none"
        >
          {children}
        </ViewTransition>
      </main>
      <footer className="site-footer mx-auto max-w-7xl px-4 sm:px-8">
        <span>{t.footerNote}</span>
        <span>{t.updatedLabel} / {site.updatedAt.replaceAll("-", ".")}</span>
      </footer>
    </div>
  );
}
