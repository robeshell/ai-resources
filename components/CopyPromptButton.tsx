"use client";

import { useState } from "react";
import { ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function CopyPromptButton({ value, locale }: { value: string; locale: Locale }) {
  const t = ui(locale);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <button type="button" className="prompt-copy-button" onClick={() => void copy()}>{copied ? t.copied : t.copyPrompt}</button>;
}
