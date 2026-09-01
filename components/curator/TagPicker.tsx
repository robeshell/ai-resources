"use client";

import { useMemo, useState } from "react";
import { Badge, Box, Button, Group, TextInput } from "@mantine/core";
import { ATTRIBUTE_TAG_GROUPS, CATEGORY_TAGS, knownTag, sortTags, tagsInGroup } from "@/lib/tags";

/**
 * One picker for the whole vocabulary — pricing and platform used to be their
 * own controls, and splitting them made the editor imply three different kinds
 * of classification when there is only one.
 *
 * Tags are chosen, not typed: free text is how a vocabulary rots into
 * 编程 / 编码 / 开发 / coding. An Agent may still propose something new, so
 * anything outside the vocabulary is kept and shown as pending rather than
 * silently dropped.
 */
export function TagPicker({ category, value, onCategoryChange, onChange }: { category: string; value: string[]; onCategoryChange: (next: string) => void; onChange: (next: string[]) => void }) {
  const [proposal, setProposal] = useState("");
  const [proposing, setProposing] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);
  const pending = useMemo(() => sortTags(value).filter((id) => !knownTag(id)), [value]);

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((tag) => tag !== id) : sortTags([...value, id]));
  }

  function selectPricing(id: string) {
    const pricing = new Set(tagsInGroup("pricing").map((tag) => tag.id));
    onChange(sortTags([...value.filter((tag) => !pricing.has(tag)), id]));
  }

  function addProposal() {
    const id = proposal.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || selected.has(id)) return;
    onChange(sortTags([...value, id]));
    setProposal("");
    setProposing(false);
  }

  return <div className="curator-tag-picker">
    <div className="curator-attr-row">
      <span className="curator-attr-label" id="curator-category-label">分类</span>
      <div className="curator-category-grid" role="radiogroup" aria-labelledby="curator-category-label">
        {CATEGORY_TAGS.map((item) => (
          <label key={item.id} className="curator-category-option" title={item.hint}>
            <input type="radio" name="curator-category" value={item.id} checked={category === item.id} onChange={() => onCategoryChange(item.id)} />
            {item.label.zh}
          </label>
        ))}
      </div>
    </div>

    {ATTRIBUTE_TAG_GROUPS.map((group) => (
      <div key={group.id} className="curator-attr-row">
        <span className="curator-attr-label">{group.label.zh}</span>
        <div className="curator-attr-options">
          {tagsInGroup(group.id).map((tag) => (
            <label key={tag.id} className="curator-attr-tag" title={tag.hint}>
              <input
                type={group.id === "pricing" ? "radio" : "checkbox"}
                {...(group.id === "pricing" ? { name: "curator-pricing" } : {})}
                checked={selected.has(tag.id)}
                onChange={() => group.id === "pricing" ? selectPricing(tag.id) : toggle(tag.id)}
              />
              {tag.label.zh}
            </label>
          ))}
        </div>
      </div>
    ))}

    {pending.length ? <div className="curator-attr-row">
      <span className="curator-attr-label">词表外</span>
      <div className="curator-attr-options">
        {pending.map((id) => (
          <Badge
            key={id}
            variant="light"
            color="orange"
            rightSection={<Box component="span" style={{ cursor: "pointer" }} onClick={() => toggle(id)}>×</Box>}
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
