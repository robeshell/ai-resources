import type { ReactNode } from "react";
import { ToolLogo } from "@/components/ToolLogo";
import { ui } from "@/lib/i18n";
import { text, type Locale, type Tool } from "@/lib/types";

/**
 * Presentation layer for the public quick-view surface. Curator no longer
 * embeds this surface; editors link to the public site after saving instead.
 */

export function ToolDialogPanel({
  tool,
  locale,
  headingId,
  closeSlot,
  onClose,
}: {
  tool: Tool;
  locale: Locale;
  headingId?: string;
  closeSlot?: ReactNode;
  onClose?: () => void;
}) {
  const t = ui(locale);
  const kind = tool.kind ?? "tool";

  return (
    <>
      <header className="dialog-header">
        <div className="dialog-tool-heading">
          <span className="dialog-logo">
            <ToolLogo tool={tool} size={48} />
          </span>
          <div>
            <p className="dialog-eyebrow">
              {t.resourceKinds[kind]}
            </p>
            <h2 id={headingId}>{tool.name}</h2>
          </div>
        </div>
        {closeSlot}
      </header>
      <div className="dialog-rule" />
      <p className="dialog-verdict">{text(tool.verdict, locale)}</p>
      <p className="dialog-summary">{text(tool.summary, locale)}</p>
      {tool.description ? <div className="dialog-description">
        {text(tool.description, locale).split(/\n\s*\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div> : null}
      <div className="dialog-actions">
        <a href={tool.url} className="btn-open t-learn" rel="noreferrer" target="_blank">
          {t.openTool} →
        </a>
        {onClose ? (
          <button type="button" className="dialog-cancel" onClick={onClose}>
            {t.close}
          </button>
        ) : null}
      </div>
    </>
  );
}
