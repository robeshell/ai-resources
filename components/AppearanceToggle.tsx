"use client";

import { useRootDataset, useRovingKeys, useSlidingPill } from "@/components/Transitions";
import { ui } from "@/lib/i18n";
import {
  applyTheme,
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";
import type { Locale } from "@/lib/types";

export function AppearanceToggle({ locale }: { locale: Locale }) {
  const t = ui(locale);
  const current = useRootDataset("theme");
  const theme: Theme = isTheme(current) ? current : DEFAULT_THEME;
  const { barRef, pillRef } = useSlidingPill(current === undefined ? undefined : theme);
  useRovingKeys(barRef);

  function choose(next: Theme) {
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <div ref={barRef} className="pill-switch" role="radiogroup" aria-label={t.themeGroup}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        tabIndex={theme === "light" ? 0 : -1}
        className={theme === "light" ? "is-active" : undefined}
        onClick={() => choose("light")}
      >
        {t.themeLight}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        tabIndex={theme === "dark" ? 0 : -1}
        className={theme === "dark" ? "is-active" : undefined}
        onClick={() => choose("dark")}
      >
        {t.themeDark}
      </button>
    </div>
  );
}
