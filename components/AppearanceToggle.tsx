"use client";

import { useMounted, useRootDataset } from "@/components/Transitions";
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
  const mounted = useMounted();
  const current = useRootDataset("theme");
  const theme: Theme = mounted && isTheme(current) ? current : DEFAULT_THEME;
  const next: Theme = theme === "dark" ? "light" : "dark";

  function choose() {
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={t.themeGroup}
      aria-pressed={theme === "dark"}
      suppressHydrationWarning
      onClick={choose}
    >
      <span className="theme-toggle-moon" aria-hidden="true" />
      <span className="theme-toggle-label" suppressHydrationWarning>
        {theme === "dark" ? t.themeDark : t.themeLight}
      </span>
    </button>
  );
}
