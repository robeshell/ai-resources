import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { localePath, ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function SiteHeader({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  const t = ui(locale);
  const other = locale === "en" ? "zh" : "en";
  const switched = pathname.replace(/^\/(en|zh)(?=\/|$)/, `/${other}`) || `/${other}`;

  return (
    <header className="site-header sticky top-0 z-20" style={{ viewTransitionName: "site-header" }}>
      <div className="site-header-inner mx-auto max-w-7xl px-4 sm:px-8">
        <Link href={localePath(locale)} className="brand" transitionTypes={["nav-back"]}>
          <BrandMark />
          <span className="brand-name">{t.siteName}</span>
        </Link>
        <div className="locale-switch">
          <Link
            href={locale === "en" ? pathname : switched}
            className={locale === "en" ? "is-active" : undefined}
            aria-current={locale === "en" ? true : undefined}
            hrefLang="en"
          >
            {t.langEn}
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={locale === "zh" ? pathname : switched}
            className={locale === "zh" ? "is-active" : undefined}
            aria-current={locale === "zh" ? true : undefined}
            hrefLang="zh"
          >
            {t.langZh}
          </Link>
        </div>
      </div>
    </header>
  );
}
