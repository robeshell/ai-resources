"use client";

import { useMemo, useState } from "react";
import { Badge, Box, Button, Chip, Group, Stack, Text, TextInput } from "@mantine/core";
import { ATTRIBUTE_TAG_GROUPS, CATEGORY_TAGS, TAGS, knownTag, sortTags } from "@/lib/tags";

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
  const selected = useMemo(() => new Set(value), [value]);
  const pending = useMemo(() => sortTags(value).filter((id) => !knownTag(id)), [value]);

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((tag) => tag !== id) : sortTags([...value, id]));
  }

  function addProposal() {
    const id = proposal.trim().toLowerCase().replace(/\s+/g, "-");
    if (!id || selected.has(id)) return;
    onChange(sortTags([...value, id]));
    setProposal("");
  }

  return <Stack gap="md">
    <Box>
      <Text size="sm" fw={600}>二级分类</Text>
      <Text size="xs" c="dimmed" mb={8}>在当前板块中只能选一个，用于资源库的主导航。</Text>
      <Group gap="xs">
        {CATEGORY_TAGS.map((item) => <Chip key={item.id} size="sm" checked={category === item.id} onChange={() => onCategoryChange(item.id)} title={item.hint}>{item.label.zh}</Chip>)}
      </Group>
    </Box>
    <Box><Text size="sm" fw={600}>卡片标签</Text><Text size="xs" c="dimmed">描述定价、平台和特性，可以多选。</Text></Box>
    {ATTRIBUTE_TAG_GROUPS.map((group) => (
      <Box key={group.id}>
        <Text size="xs" c="dimmed" mb={6}>{group.label.zh}</Text>
        <Group gap="xs">
          {TAGS.filter((tag) => tag.group === group.id).map((tag) => (
            <Chip
              key={tag.id}
              size="sm"
              checked={selected.has(tag.id)}
              onChange={() => toggle(tag.id)}
              title={tag.hint}
            >
              {tag.label.zh}
            </Chip>
          ))}
        </Group>
      </Box>
    ))}

    {pending.length ? <Box>
      <Text size="xs" c="dimmed" mb={6}>待归入词表</Text>
      <Group gap="xs">
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
      </Group>
      <Text size="xs" c="dimmed" mt={6}>
        Agent 提的新标签。留着它就只在这条内容上生效；要长期用，把它加进 data/tags.json 并补上英文名。
      </Text>
    </Box> : null}

    <Group gap="xs" align="flex-end">
      <TextInput
        size="xs"
        label="新标签"
        description="词表里实在没有合适的才加"
        placeholder="英文小写，用连字符"
        value={proposal}
        onChange={(event) => setProposal(event.currentTarget.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addProposal(); } }}
        style={{ flex: "1 1 12rem" }}
      />
      <Button size="xs" variant="default" disabled={!proposal.trim()} onClick={addProposal}>加上</Button>
    </Group>
  </Stack>;
}
