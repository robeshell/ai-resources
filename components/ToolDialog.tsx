"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ToolLogo } from "@/components/ToolLogo";
import { localePath, ui } from "@/lib/i18n";
import { text, type Locale, type Tool } from "@/lib/types";

export function ToolDialog({
  tool,
  locale,
  onClose,
}: {
  tool: Tool | null;
  locale: Locale;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const t = ui(locale);
  const kind = tool?.kind ?? "tool";

  useEffect(() => {
    if (!tool) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, tool]);

  if (!tool) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="tool-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tool-dialog-${tool.id}`}
      >
        <header className="dialog-header">
          <div className="dialog-tool-heading">
            <span className="dialog-logo">
              <ToolLogo tool={tool} size={48} />
            </span>
            <div>
              <p className="dialog-eyebrow">{t.resourceKinds[kind]} / {t.pricing[tool.pricing]}</p>
              <h2 id={`tool-dialog-${tool.id}`}>{tool.name}</h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="dialog-close"
            aria-label={t.close}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="dialog-rule" />
        <p className="dialog-verdict">{text(tool.verdict, locale)}</p>
        <p className="dialog-summary">{text(tool.summary, locale)}</p>
        <div className="dialog-tags">
          <span className={`price-tag price-${tool.pricing}`}>{t.pricing[tool.pricing]}</span>
          {tool.platforms.map((platform) => (
            <span key={platform} className="platform-tag">{t.platform[platform]}</span>
          ))}
        </div>
        <div className="dialog-actions">
          <a href={tool.url} className="btn-open t-learn" rel="noreferrer" target="_blank">
            {t.openTool}
            <span className="dialog-action-arrow" aria-hidden="true">↗</span>
          </a>
          <Link href={localePath(locale, `/t/${tool.slug}`)} className="dialog-details" transitionTypes={["nav-forward"]}>
            {t.viewDetails}
          </Link>
          <button type="button" className="dialog-cancel" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </section>
    </div>
  );
}
