"use client";

import { useEffect, useRef, useState } from "react";
import { ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function CopyPromptButton({
  value,
  locale,
  className = "prompt-copy-button",
}: {
  value: string;
  locale: Locale;
  className?: string;
}) {
  const t = ui(locale);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    resetTimer.current = setTimeout(() => setStatus("idle"), 2400);
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite" aria-atomic="true">
      {status === "copied" ? t.copied : status === "error" ? (locale === "zh" ? "复制失败，请重试" : "Copy failed. Retry") : t.copyPrompt}
    </button>
  );
}
