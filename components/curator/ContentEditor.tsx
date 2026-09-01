"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Flex, Group, Menu, Modal, Paper,
  Select, SimpleGrid, Skeleton, Stack, Text, Textarea,
  TextInput, Title,
} from "@mantine/core";
import { ExamplesEditor, StructuredLinks, VariablesEditor } from "@/components/curator/StructuredFields";
import { ConversationPanel } from "@/components/curator/ConversationPanel";
import { MarkdownEditor } from "@/components/curator/MarkdownEditor";
import { TagPicker } from "@/components/curator/TagPicker";
import type { ArticlePayload, ContentBlockId, ContentStatus, PromptPayload, ToolPayload } from "@/lib/content-blocks";
import { BLOCK_LABELS, curatorRequest, type CuratorContentItem } from "@/lib/curator-client";
import { curatorEditorHref } from "@/lib/curator-routes";

type EditableBlock = Extract<ContentBlockId, "tool" | "skill" | "project" | "prompt">;

function blankPayload(block: EditableBlock): CuratorContentItem["payload"] {
  if (block === "tool") return { tagline: { zh: "", en: "" }, summary: { zh: "", en: "" }, url: "" } satisfies ToolPayload;
  if (block === "prompt") return { summary: { zh: "", en: "" }, prompt: "", variables: [], examples: [], links: [] } satisfies PromptPayload;
  return { summary: { zh: "", en: "" }, body: "", links: [] } satisfies ArticlePayload;
}

function blankItem(block: EditableBlock): CuratorContentItem {
  const at = new Date().toISOString();
  return { id: "", blockType: block, slug: "", title: "", status: "draft", category: "", tags: [], createdAt: at, updatedAt: at, payload: blankPayload(block) };
}

function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <Paper component="section" withBorder p={{ base: "md", sm: "lg" }} className="curator-editor-section">
    <Flex direction="column" gap={6} className="curator-editor-section-heading">
      <Title order={2}>{title}</Title>
      {description ? <Text size="xs" c="dimmed" lh={1.5}>{description}</Text> : null}
    </Flex>
    <Box mt="md">{children}</Box>
  </Paper>;
}

export function ContentEditor({ block, slug }: { block: EditableBlock; slug: string }) {
  const router = useRouter(); const isNew = slug === "new";
  const [original, setOriginal] = useState<CuratorContentItem | null>(null);
  const [draft, setDraft] = useState<CuratorContentItem>(() => blankItem(block));
  const [loading, setLoading] = useState(!isNew); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);
  const dirty = useMemo(() => JSON.stringify(original || blankItem(block)) !== JSON.stringify(draft), [block, draft, original]);

  useEffect(() => { if (isNew) return; curatorRequest<{ item: CuratorContentItem }>(`/content/${encodeURIComponent(slug)}`).then(({ item }) => { if (item.blockType !== block) throw new Error("内容板块与地址不一致"); setOriginal(item); setDraft(structuredClone(item)); }).catch((caught) => setError(caught instanceof Error ? caught.message : "内容读取失败")).finally(() => setLoading(false)); }, [block, isNew, slug]);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  function updateItem<K extends keyof CuratorContentItem>(key: K, value: CuratorContentItem[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updatePayload(next: CuratorContentItem["payload"]) { setDraft((current) => ({ ...current, payload: next })); }
  function updateLocalized(field: "summary" | "tagline" | "description", locale: "zh" | "en", value: string) { const payload = draft.payload as Record<string, unknown>; const current = payload[field] as Record<string, string> | undefined; updatePayload({ ...payload, [field]: { ...(current || { zh: "", en: "" }), [locale]: value } } as CuratorContentItem["payload"]); }
  async function save() {
    setBusy(true); setError("");
    try { const normalized = { ...draft, id: draft.id || draft.slug, slug: draft.slug.trim(), title: draft.title.trim() }; const result = await curatorRequest<{ item: CuratorContentItem }>("/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: normalized, revisionId: original?.revision?.id }) }); setOriginal(result.item); setDraft(structuredClone(result.item)); if (isNew || slug !== result.item.slug) router.replace(curatorEditorHref(block, result.item.slug)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); } finally { setBusy(false); }
  }
  function archive() { setConfirm(null); setDraft((current) => ({ ...current, status: "archived" })); }
  async function remove() { setBusy(true); setError(""); try { await curatorRequest(`/content/${encodeURIComponent(draft.id)}?revisionId=${original?.revision?.id ?? ""}`, { method: "DELETE" }); router.push(`/curator/resources/?block=${block}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); setBusy(false); } }

  if (loading) return <Stack gap="md"><Skeleton h={42} w="35%" /><Skeleton h={260} /><Skeleton h={340} /></Stack>;
  const tool = block === "tool" ? draft.payload as ToolPayload : null;
  const article = block === "skill" || block === "project" ? draft.payload as ArticlePayload : null;
  const prompt = block === "prompt" ? draft.payload as PromptPayload : null;

  const conversationContentId = !isNew && original?.id ? original.id : null;
  const saveStatus = error || (busy ? "保存中" : dirty ? "修改中" : "已保存");

  return <div className={conversationContentId ? "curator-editor-split" : undefined}>
    {conversationContentId ? <Box className="curator-editor-chat"><ConversationPanel contentId={conversationContentId} currentPayload={{ ...(draft.payload as Record<string, unknown>), category: draft.category, tags: draft.tags }} context={{ title: draft.title || `未命名${BLOCK_LABELS[block]}`, backHref: `/curator/resources/?block=${block}`, backLabel: `${BLOCK_LABELS[block]}列表` }} hint="这个条目还没有对话。说想改什么，Agent 会给出可逐项采用的修改。" onAdopt={(adopted) => { const { category, tags, ...payload } = adopted; if (typeof category === "string") updateItem("category", category); if (Array.isArray(tags)) updateItem("tags", tags.map(String)); updatePayload(payload as CuratorContentItem["payload"]); }} /></Box> : null}
    <Stack gap={0} className="curator-editor-main" style={{ minWidth: 0 }}>
    <Box className="curator-editor-form-scroll">
    {!conversationContentId ? <Flex justify="space-between" align="flex-end" gap="lg" wrap="wrap" className="curator-page-heading-mantine"><Box><Text component={Link} href={`/curator/resources/?block=${block}`} size="sm" c="dimmed" className="curator-back-link">← 返回{BLOCK_LABELS[block]}列表</Text><Text className="curator-eyebrow-mantine" mt="md">新建{BLOCK_LABELS[block]}</Text><Title order={1} mt={4}>{draft.title || `未命名${BLOCK_LABELS[block]}`}</Title></Box></Flex> : null}
    <Stack gap="md">
      <EditorSection title="基本信息" description="用于资源库索引和公开站识别。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="标题" value={draft.title} onChange={(event) => updateItem("title", event.currentTarget.value)} /><TextInput label="Slug" value={draft.slug} onChange={(event) => updateItem("slug", event.currentTarget.value)} /><TextInput label="来源链接" value={draft.sourceUrl || ""} onChange={(event) => updateItem("sourceUrl", event.currentTarget.value)} placeholder="https://…" /><Select label="内容状态" value={draft.status} onChange={(value) => updateItem("status", (value || "draft") as ContentStatus)} data={[{ value: "draft", label: "草稿" }, { value: "active", label: "已发布" }, { value: "archived", label: "已归档" }]} /></SimpleGrid></EditorSection>
      <EditorSection title="分类与标签" description="分类决定放在哪一栏；标签描述这张卡片本身。"><TagPicker category={draft.category} value={draft.tags} onCategoryChange={(category) => updateItem("category", category)} onChange={(tags) => updateItem("tags", tags)} /></EditorSection>
      {tool ? <>
        <EditorSection title="工具入口" description="访问方式。定价和平台都是标签，在上面一起选。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="Logo 路径" value={tool.logo || ""} onChange={(event) => updatePayload({ ...tool, logo: event.currentTarget.value })} placeholder="/logos/…" /><TextInput label="官网链接" value={tool.url} onChange={(event) => updatePayload({ ...tool, url: event.currentTarget.value })} /></SimpleGrid></EditorSection>
        <EditorSection title="卡片文案" description="列表卡片只显示定位和摘要。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="中文定位" value={tool.tagline.zh} onChange={(event) => updateLocalized("tagline", "zh", event.currentTarget.value)} /><TextInput label="English verdict" value={tool.tagline.en} onChange={(event) => updateLocalized("tagline", "en", event.currentTarget.value)} /><Textarea label="中文简介" minRows={3} value={tool.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={3} value={tool.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection>
        <EditorSection title="快速查看" description="点击工具卡片后显示的补充介绍。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文短详情" description="建议两小段、120–240 字。" rows={10} resize="none" value={tool.description?.zh || ""} onChange={(event) => updateLocalized("description", "zh", event.currentTarget.value)} /><Textarea label="English details" description="Two short paragraphs." rows={10} resize="none" value={tool.description?.en || ""} onChange={(event) => updateLocalized("description", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection>
      </> : null}
      {article ? <><EditorSection title="摘要" description="中英文摘要用于列表和搜索结果。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={article.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={article.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="正文" description="使用 Markdown 编写公开阅读页正文。"><MarkdownEditor value={article.body} onChange={(body) => updatePayload({ ...article, body })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={article.links} onChange={(links) => updatePayload({ ...article, links })} /></EditorSection></> : null}
      {prompt ? <><EditorSection title="摘要"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={prompt.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={prompt.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="提示词正文"><MarkdownEditor label="Prompt" minHeight="20rem" value={prompt.prompt} onChange={(next) => updatePayload({ ...prompt, prompt: next })} /></EditorSection><EditorSection title="变量"><VariablesEditor value={prompt.variables} onChange={(variables) => updatePayload({ ...prompt, variables })} /></EditorSection><EditorSection title="示例"><ExamplesEditor value={prompt.examples} onChange={(examples) => updatePayload({ ...prompt, examples })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={prompt.links} onChange={(links) => updatePayload({ ...prompt, links })} /></EditorSection></> : null}
    </Stack>
    </Box>
    <Paper withBorder p="sm" className="curator-savebar-mantine"><Flex align="center" justify="space-between" gap="md" wrap="wrap"><Text size="sm" fw={500} c={error ? "red" : dirty ? "orange" : "dimmed"} role={error ? "alert" : "status"} className="curator-save-status">{saveStatus}</Text><Group gap="xs">{!isNew ? <Menu position="top-end" shadow="md" withinPortal><Menu.Target><Button variant="default">更多</Button></Menu.Target><Menu.Dropdown>{draft.status !== "archived" ? <><Menu.Item onClick={() => setConfirm("archive")}>归档</Menu.Item><Menu.Divider /></> : null}<Menu.Item color="red" onClick={() => setConfirm("delete")}>删除</Menu.Item></Menu.Dropdown></Menu> : null}<Button variant="subtle" disabled={!dirty || busy} onClick={() => original && setDraft(structuredClone(original))}>放弃修改</Button><Button loading={busy} disabled={!dirty || !draft.title.trim() || !draft.slug.trim()} onClick={() => void save()}>保存修改</Button></Group></Flex></Paper>
    <Modal opened={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? "永久删除这条内容？" : "归档这条内容？"} centered><Text size="sm" c="dimmed">{confirm === "delete" ? "删除后无法从资源库恢复，公开派生文件也会同步移除。" : "归档后内容不会出现在公开站，保存后生效。"}</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfirm(null)}>取消</Button><Button color={confirm === "delete" ? "red" : "curator"} onClick={() => confirm === "delete" ? void remove() : void archive()}>{confirm === "delete" ? "确认删除" : "确认归档"}</Button></Group></Modal>
    </Stack>
  </div>;
}
