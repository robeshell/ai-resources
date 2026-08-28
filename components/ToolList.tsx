"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import { TiltCard } from "@/components/TiltCard";
import { ToolDialog } from "@/components/ToolDialog";
import { ToolLogo } from "@/components/ToolLogo";
import { localePath, ui } from "@/lib/i18n";
import { text, type Locale, type Tool } from "@/lib/types";

export function ToolCard({
  tool,
  locale,
  index = 0,
  section = 0,
  onSelect,
  showTags = true,
}: {
  tool: Tool;
  locale: Locale;
  index?: number;
  section?: number;
  onSelect?: (tool: Tool) => void;
  showTags?: boolean;
}) {
  const t = ui(locale);
  const kind = tool.kind ?? "tool";
  return (
    <TiltCard
      href={onSelect ? undefined : localePath(locale, `/t/${tool.slug}`)}
      transitionTypes={["nav-forward"]}
      category={tool.category}
      onClick={onSelect ? () => onSelect(tool) : undefined}
      className={!showTags ? "tool-card--bare" : undefined}
    >
      <span className="catalog-topline">
        <span className={`resource-kind resource-kind--${kind}`}>{t.resourceKinds[kind]}</span>
      </span>
      <span className="catalog-body">
        <span
          className="catalog-stage"
          style={{ "--i": index, "--section": section } as CSSProperties}
        >
          <ToolLogo tool={tool} size={38} />
        </span>
        <span className="catalog-meta">
          <span className="tool-name">{tool.name}</span>
          <span className="tool-verdict">{text(tool.verdict, locale)}</span>
        </span>
      </span>
      {showTags ? (
        <span className="tool-card-footer">
          <span className="tool-tags">
            <span className={`price-tag price-${tool.pricing}`}>{t.pricing[tool.pricing]}</span>
            {tool.platforms[0] ? <span className="platform-tag">{t.platform[tool.platforms[0]]}</span> : null}
          </span>
        </span>
      ) : null}
    </TiltCard>
  );
}

export function ToolList({
  tools,
  locale,
  section = 0,
  showTags = true,
}: {
  tools: Tool[];
  locale: Locale;
  section?: number;
  showTags?: boolean;
}) {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const closeDialog = useCallback(() => setSelectedTool(null), []);

  return (
    <>
      <div className="tool-grid">
        {tools.map((tool, index) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            locale={locale}
            index={index}
            section={section}
            onSelect={setSelectedTool}
            showTags={showTags}
          />
        ))}
      </div>
      <ToolDialog
        tool={selectedTool}
        locale={locale}
        onClose={closeDialog}
      />
    </>
  );
}
