"use client";

import { useCallback, useMemo, useState } from "react";
import { ToolDialog } from "@/components/ToolDialog";
import { ToolLogo } from "@/components/ToolLogo";
import { categoriesForBlock, categoryOf } from "@/lib/tags";
import type { Locale, Tool } from "@/lib/types";

export function ToolList({ tools, locale }: { tools: Tool[]; locale: Locale; section?: number }) {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const closeDialog = useCallback(() => setSelectedTool(null), []);
  const groups = useMemo(() => {
    const known = categoriesForBlock("tool").map((category) => ({
      id: category.id,
      label: category.label[locale],
      tools: tools.filter((tool) => categoryOf(tool, "tool") === category.id),
    })).filter((group) => group.tools.length);
    const uncategorized = tools.filter((tool) => !categoryOf(tool, "tool"));
    return uncategorized.length
      ? [...known, { id: "uncategorized", label: locale === "zh" ? "未分类" : "Other", tools: uncategorized }]
      : known;
  }, [locale, tools]);

  return (
    <>
      <div className="tool-directory">
        {groups.map((group) => (
          <section className={`tool-directory-group${group.id === "uncategorized" ? " tool-directory-group--wide" : ""}`} key={group.id} aria-labelledby={`tool-group-${group.id}`}>
            <header className="tool-directory-heading">
              <h3 id={`tool-group-${group.id}`}>{group.label}</h3>
              <span>{group.tools.length}</span>
            </header>
            <div className="tool-directory-list">
              {group.tools.map((tool) => (
                <button type="button" className="tool-directory-row" key={tool.id} onClick={() => setSelectedTool(tool)}>
                  <span className="tool-directory-logo"><ToolLogo tool={tool} size={20} /></span>
                  <span className="tool-directory-name">{tool.name}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ToolDialog tool={selectedTool} locale={locale} onClose={closeDialog} />
    </>
  );
}
