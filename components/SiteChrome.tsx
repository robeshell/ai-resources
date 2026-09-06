"use client";

import { useEffect } from "react";
import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { CatalogProvider } from "@/components/CatalogNavigation";
import { AppearanceToggle } from "@/components/AppearanceToggle";
import { AccentPicker } from "@/components/AccentPicker";
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

  const isHome = pathname.replace(/\/$/, "") === `/${locale}`;

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  return (
    <CatalogProvider>
    <div id="site-root" className={isHome ? "catalog-home" : undefined}>
      <a href="#main" className="skip-link">
        {t.skip}
      </a>
      <SiteHeader
        locale={locale}
        pathname={pathname}
        isHome={isHome}
      />
      <main
        id="main"
        className="site-content"
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
      <footer className="site-footer">
        {isHome ? (
          <>
            <span className="footer-updated">{t.updatedLabel} {site.updatedAt.replaceAll("-", ".")}</span>
            <AppearanceToggle locale={locale} />
          </>
        ) : (
          <>
            <span className="footer-note">{t.footerNote}</span>
            <AccentPicker locale={locale} />
            <span className="footer-updated">{t.updatedLabel} {site.updatedAt.replaceAll("-", ".")}</span>
          </>
        )}
      </footer>
    </div>
    </CatalogProvider>
  );
}
