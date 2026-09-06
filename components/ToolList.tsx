"use client";

import { useCallback, useState } from "react";
import { ToolDialog } from "@/components/ToolDialog";
import { ResourceDirectory } from "@/components/ResourceDirectory";
import type { Locale, Tool } from "@/lib/types";

export function ToolList({ tools, locale }: { tools: Tool[]; locale: Locale; section?: number }) {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const closeDialog = useCallback(() => setSelectedTool(null), []);
  return (
    <>
      <ResourceDirectory items={tools} block="tool" locale={locale} onSelect={setSelectedTool} />
      <ToolDialog tool={selectedTool} locale={locale} onClose={closeDialog} />
    </>
  );
}
