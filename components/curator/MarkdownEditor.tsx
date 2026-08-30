"use client";

import { useMemo, useState } from "react";
import { Box, Group, SegmentedControl, Text } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { MarkdownBody } from "@/components/MarkdownBody";

/** Paper-toned to match the surrounding Mantine surfaces rather than shipping a
 *  second theme. Heading and emphasis weights come from the Markdown parser, so
 *  structure is visible while the text stays plain Markdown. */
const theme = EditorView.theme({
  "&": { fontSize: "0.875rem", backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-plex-mono), ui-monospace, monospace", lineHeight: "1.7" },
  ".cm-content": { padding: "0.75rem 0" },
  ".cm-gutters": { border: "none", backgroundColor: "transparent", color: "#a8a49c" },
  ".cm-activeLine": { backgroundColor: "rgba(206, 82, 20, 0.04)" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "#fde4d4" },
  ".cm-cursor": { borderLeftColor: "#ce5214" },
});

export function MarkdownEditor({
  value,
  onChange,
  label = "Markdown",
  minHeight = "26rem",
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  minHeight?: string;
}) {
  const [view, setView] = useState<"edit" | "preview" | "split">("edit");
  const extensions = useMemo(
    () => [markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping, theme],
    [],
  );

  const editor = (
    <Box className="curator-markdown-editor" style={{ minHeight }}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true, autocompletion: false }}
        style={{ minHeight }}
        aria-label={label}
      />
    </Box>
  );

  const preview = (
    <Box className="curator-markdown-preview" style={{ minHeight }}>
      {value.trim()
        ? <MarkdownBody source={value} />
        : <Text size="sm" c="dimmed">还没有正文，左边写点什么。</Text>}
    </Box>
  );

  return <Box>
    <Group justify="space-between" align="center" mb="xs">
      <Text size="sm" fw={500} c="#514f49">{label}</Text>
      <SegmentedControl
        size="xs"
        value={view}
        onChange={(next) => setView(next as typeof view)}
        data={[{ value: "edit", label: "编辑" }, { value: "split", label: "对照" }, { value: "preview", label: "预览" }]}
      />
    </Group>
    {view === "split"
      ? <div className="curator-markdown-split">{editor}{preview}</div>
      : view === "preview" ? preview : editor}
    <Text size="xs" c="dimmed" mt={6}>预览用的是公开站同一套渲染器，所见即线上效果。</Text>
  </Box>;
}
