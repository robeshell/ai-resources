"use client";

import { Button, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import type { ContentLink, PromptExample, PromptVariable } from "@/lib/content-blocks";

const linkKinds = [
  { value: "official", label: "官网" },
  { value: "docs", label: "文档" },
  { value: "repository", label: "仓库" },
  { value: "reference", label: "参考" },
  { value: "other", label: "其他" },
];

export function StructuredLinks({ value, onChange, error }: { value: ContentLink[]; onChange: (next: ContentLink[]) => void; error?: string }) {
  return <Stack gap="sm">
    {error ? <Text c="red" size="xs" role="alert" tabIndex={-1} data-validation-error="true">{error}</Text> : null}
    {value.map((link, index) => <Paper withBorder p="sm" key={index}>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        <TextInput label="名称" aria-label={`链接 ${index + 1} 名称`} value={link.label} placeholder="链接名称" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.currentTarget.value } : item))} />
        <TextInput label="地址" aria-label={`链接 ${index + 1} 地址`} value={link.url} placeholder="https://…" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.currentTarget.value } : item))} />
        <Select label="类型" aria-label={`链接 ${index + 1} 类型`} value={link.kind || "other"} data={linkKinds} onChange={(kind) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, kind: (kind || "other") as ContentLink["kind"] } : item))} />
      </SimpleGrid>
      <Group justify="flex-end" mt="sm"><Button type="button" color="red" variant="subtle" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>移除</Button></Group>
    </Paper>)}
    <Button type="button" variant="default" onClick={() => onChange([...value, { label: "", url: "", kind: "other" }])}>添加链接</Button>
  </Stack>;
}

export function VariablesEditor({ value, onChange }: { value: PromptVariable[]; onChange: (next: PromptVariable[]) => void }) {
  return <Stack gap="sm">
    {value.map((variable, index) => <Paper withBorder p="sm" key={index}>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        <TextInput label="变量名" value={variable.name} aria-label={`变量 ${index + 1} 名称`} placeholder="name" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.currentTarget.value } : item))} />
        <TextInput label="说明" value={variable.description} aria-label={`变量 ${index + 1} 说明`} placeholder="这个变量控制什么" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.currentTarget.value } : item))} />
        <TextInput label="示例" value={variable.example || ""} aria-label={`变量 ${index + 1} 示例`} placeholder="可选" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, example: event.currentTarget.value } : item))} />
      </SimpleGrid>
      <Group justify="flex-end" mt="sm"><Button type="button" color="red" variant="subtle" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>移除</Button></Group>
    </Paper>)}
    <Button type="button" variant="default" onClick={() => onChange([...value, { name: "", description: "", example: "" }])}>添加变量</Button>
  </Stack>;
}

export function ExamplesEditor({ value, onChange }: { value: PromptExample[]; onChange: (next: PromptExample[]) => void }) {
  return <Stack gap="sm">
    {value.map((example, index) => <Paper withBorder p="sm" key={index}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
        <Textarea minRows={5} label="输入" value={example.input} aria-label={`示例 ${index + 1} 输入`} placeholder="示例输入" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, input: event.currentTarget.value } : item))} />
        <Textarea minRows={5} label="输出" value={example.output} aria-label={`示例 ${index + 1} 输出`} placeholder="预期输出" onChange={(event) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, output: event.currentTarget.value } : item))} />
      </SimpleGrid>
      <Group justify="flex-end" mt="sm"><Button type="button" color="red" variant="subtle" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>移除</Button></Group>
    </Paper>)}
    <Button type="button" variant="default" onClick={() => onChange([...value, { input: "", output: "" }])}>添加示例</Button>
  </Stack>;
}
