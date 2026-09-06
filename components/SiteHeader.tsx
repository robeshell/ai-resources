"use client";

import Link from "next/link";
import { CatalogNavigation, useCatalog } from "@/components/CatalogNavigation";
import { AppearanceToggle } from "@/components/AppearanceToggle";
import { BrandMark } from "@/components/BrandMark";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { localePath, ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function SiteHeader({
  locale,
  pathname,
  isHome = false,
}: {
  locale: Locale;
  pathname: string;
  isHome?: boolean;
}) {
  const t = ui(locale);
  const { activeKind, selectKind } = useCatalog();

  return (
    <header className="site-header" style={{ viewTransitionName: "site-header" }}>
      <div className="site-header-inner">
        <Link href={localePath(locale)} className="brand" transitionTypes={["nav-back"]} onClick={isHome ? () => selectKind("tool") : undefined}>
          <BrandMark size={34} />
          <span className="brand-name">{t.siteName}</span>
        </Link>
        {isHome && <CatalogNavigation locale={locale} />}
        <div className="site-header-actions">
          {!isHome && <AppearanceToggle locale={locale} />}
          <LocaleSwitch locale={locale} pathname={isHome ? `${pathname}?kind=${activeKind}` : pathname} />
        </div>
      </div>
    </header>
  );
}
