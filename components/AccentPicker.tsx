"use client";

import { useRef } from "react";
import { useMounted, useRootDataset, useRovingKeys } from "@/components/Transitions";
import { ui } from "@/lib/i18n";
import {
  ACCENTS,
  applyAccent,
  DEFAULT_ACCENT,
  isAccent,
  ACCENT_STORAGE_KEY,
  type Accent,
} from "@/lib/theme";
import type { Locale } from "@/lib/types";

export function AccentPicker({ locale }: { locale: Locale }) {
  const t = ui(locale);
  const barRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const current = useRootDataset("accent");
  const accent: Accent = mounted && isAccent(current) ? current : DEFAULT_ACCENT;
  useRovingKeys(barRef);

  function choose(next: Accent) {
    applyAccent(next);
    localStorage.setItem(ACCENT_STORAGE_KEY, next);
  }

  return (
    <div ref={barRef} className="accent-picker" role="radiogroup" aria-label={t.accentGroup} suppressHydrationWarning>
      {ACCENTS.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={accent === value}
          tabIndex={accent === value ? 0 : -1}
          aria-label={t.accents[value]}
          data-swatch={value}
          className={accent === value ? "is-active" : undefined}
          onClick={() => choose(value)}
        />
      ))}
    </div>
  );
}
