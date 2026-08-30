"use client";

import Link from "next/link";
import { useSlidingPill } from "@/components/Transitions";
import { switchLocalePath, ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function LocaleSwitch({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  const t = ui(locale);
  const other = locale === "en" ? "zh" : "en";
  const { barRef, pillRef } = useSlidingPill(locale);

  return (
    <div ref={barRef} className="pill-switch">
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      <Link
        href={switchLocalePath(locale, locale, pathname)}
        className={locale === "en" ? "is-active" : undefined}
        aria-current={locale === "en" ? true : undefined}
        hrefLang="en"
      >
        {t.langEn}
      </Link>
      <span aria-hidden>/</span>
      <Link
        href={switchLocalePath(locale, other, pathname)}
        className={locale === "zh" ? "is-active" : undefined}
        aria-current={locale === "zh" ? true : undefined}
        hrefLang="zh"
      >
        {t.langZh}
      </Link>
    </div>
  );
}
