"use client";

import { useMemo, useState } from "react";
import { ActionIcon, Badge, Button, Group, Text, TextInput } from "@mantine/core";
import type { EnabledContentBlockId } from "@/lib/content-blocks";
import { TAGS, categoriesForBlock, knownTag, sortTags } from "@/lib/tags";

/**
 * One flat picker for the whole vocabulary. Groups only keep the vocabulary in
 * a stable order; they do not change how a tag behaves in the editor.
 *
 * Tags are chosen, not typed: free text is how a vocabulary rots into
 * 编程 / 编码 / 开发 / coding. An Agent may still propose something new, so
 * anything outside the vocabulary is kept and shown as pending rather than
 * silently dropped.
 */
export function CategoryPicker({ block, value, onChange, error }: { block: EnabledContentBlockId; value: string; onChange: (next: string) => void; error?: string }) {
  const categories = categoriesForBlock(block);
  return <div className="curator-category-picker">
    <div className="curator-category-grid" role="radiogroup" aria-label="分类" aria-invalid={error ? true : undefined} aria-describedby={error ? "curator-category-error" : undefined}>
      {categories.map((item) => (
        <label key={item.id} className="curator-category-option" title={item.hint}>
          <input type="radio" name="curator-category" value={item.id} checked={value === item.id} onChange={() => onChange(item.id)} />
          {item.label.zh}
        </label>
      ))}
    </div>
    {error ? <Text id="curator-category-error" c="red" size="xs" mt={6}>{error}</Text> : null}
  </div>;
}

export function TagPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [proposal, setProposal] = useState("");
  const [proposing, setProposing] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const pending = useMemo(() => sortTags(value).filter((id) => !knownTag(id)), [value]);
  const tags = TAGS;

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((tag) => tag !== id) : sortTags([...value, id]));
  }

  function addProposal() {
    const id = proposal.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || selected.has(id)) return;
    onChange(sortTags([...value, id]));
    setProposal("");
    setProposing(false);
  }

  return <div className="curator-tag-picker curator-tag-picker-flat">
    <div className="curator-attr-options" aria-label="标签">
      {tags.map((tag) => (
        <label key={tag.id} className="curator-attr-tag" title={tag.hint}>
          <input
            type="checkbox"
            checked={selected.has(tag.id)}
            onChange={() => toggle(tag.id)}
          />
          {tag.label.zh}
        </label>
      ))}
    </div>

    {pending.length ? <div className="curator-pending-tags">
      <span className="curator-attr-label">词表外</span>
      <div className="curator-attr-options">
        {pending.map((id) => (
          <Badge
            key={id}
            variant="light"
            color="orange"
            rightSection={<ActionIcon size="xs" variant="transparent" color="orange" aria-label={`删除标签 ${id}`} onClick={() => toggle(id)}>×</ActionIcon>}
          >
            {id}
          </Badge>
        ))}
      </div>
    </div> : null}

    {proposing ? (
      <Group gap="xs" align="flex-end" className="curator-tag-propose">
        <TextInput
          size="xs"
          aria-label="词表外标签"
          placeholder="英文小写，用连字符"
          value={proposal}
          onChange={(event) => setProposal(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addProposal(); } }}
          style={{ flex: "1 1 10rem" }}
        />
        <Button size="xs" variant="default" disabled={!proposal.trim()} onClick={addProposal}>加上</Button>
        <Button size="xs" variant="subtle" color="gray" onClick={() => { setProposing(false); setProposal(""); }}>取消</Button>
      </Group>
    ) : (
      <Button size="compact-xs" variant="subtle" color="gray" className="curator-tag-propose-toggle" onClick={() => setProposing(true)}>添加词表外标签</Button>
    )}
  </div>;
}
