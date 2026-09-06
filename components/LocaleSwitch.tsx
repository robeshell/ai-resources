"use client";

import Link from "next/link";
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
  const nextLocale = locale === "zh" ? "en" : "zh";
  const label = locale === "zh" ? "切换为英文 (EN)" : "Switch to Chinese (中文)";

  return (
    <Link
      href={switchLocalePath(locale, nextLocale, pathname)}
      className="locale-switch"
      hrefLang={nextLocale}
      lang={nextLocale}
      aria-label={label}
      title={label}
    >
      {nextLocale === "en" ? t.langEn : t.langZh}
    </Link>
  );
}
