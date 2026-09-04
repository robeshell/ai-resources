"use client";

import { useState } from "react";
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
  const [copied, setCopied] = useState(false);

  async function copy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? t.copied : t.copyPrompt}
    </button>
  );
}
