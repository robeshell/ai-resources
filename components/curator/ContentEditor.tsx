"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Flex, Group, Menu, Modal, Paper,
  Select, SimpleGrid, Skeleton, Stack, Text, Textarea,
  TextInput, Title,
} from "@mantine/core";
import { ExamplesEditor, StructuredLinks, VariablesEditor } from "@/components/curator/StructuredFields";
import { ConversationPanel } from "@/components/curator/ConversationPanel";
import { MarkdownEditor } from "@/components/curator/MarkdownEditor";
import { CategoryPicker, TagPicker } from "@/components/curator/TagPicker";
import type { ArticlePayload, ContentBlockId, ContentStatus, PromptPayload, ToolPayload } from "@/lib/content-blocks";
import { BLOCK_LABELS, curatorRequest, type CuratorContentItem } from "@/lib/curator-client";
import { curatorEditorHref } from "@/lib/curator-routes";
import { CuratorPageHeader } from "@/components/curator/CuratorPageHeader";

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
  const [initialDraft] = useState<CuratorContentItem>(() => blankItem(block));
  const [original, setOriginal] = useState<CuratorContentItem | null>(null);
  const [draft, setDraft] = useState<CuratorContentItem>(() => structuredClone(initialDraft));
  const [loading, setLoading] = useState(!isNew); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [loadError, setLoadError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [leaveHistory, setLeaveHistory] = useState(false);
  const allowNavigation = useRef(false);
  const restoringHistory = useRef(false);
  const dirty = useMemo(() => JSON.stringify(original || initialDraft) !== JSON.stringify(draft), [draft, initialDraft, original]);
  const conversationPayload = useMemo(() => original ? {
    ...(original.payload as Record<string, unknown>),
    category: original.category,
    tags: original.tags,
  } : {}, [original]);

  useEffect(() => { if (isNew) return; curatorRequest<{ item: CuratorContentItem }>(`/content/${encodeURIComponent(slug)}`).then(({ item }) => { if (item.blockType !== block) throw new Error("内容板块与地址不一致"); setOriginal(item); setDraft(structuredClone(item)); }).catch((caught) => setLoadError(caught instanceof Error ? caught.message : "内容读取失败")).finally(() => setLoading(false)); }, [block, isNew, slug]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { if (!allowNavigation.current) event.preventDefault(); };
    const guardLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
      if (!anchor || anchor.target === "_blank" || anchor.download || new URL(anchor.href, window.location.href).origin !== window.location.origin) return;
      event.preventDefault(); event.stopPropagation(); setLeaveHref(anchor.href);
    };
    const guardHistory = () => {
      if (allowNavigation.current) return;
      if (restoringHistory.current) { restoringHistory.current = false; return; }
      restoringHistory.current = true; window.history.forward(); setLeaveHistory(true);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    window.addEventListener("popstate", guardHistory);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guardLinks, true); window.removeEventListener("popstate", guardHistory); };
  }, [dirty]);
  function discardAndLeave() {
    allowNavigation.current = true;
    if (leaveHistory) { setLeaveHistory(false); window.history.back(); return; }
    if (leaveHref) { const target = new URL(leaveHref); setLeaveHref(null); router.push(`${target.pathname}${target.search}${target.hash}`); }
  }

  function updateItem<K extends keyof CuratorContentItem>(key: K, value: CuratorContentItem[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updatePayload(next: CuratorContentItem["payload"]) { setDraft((current) => ({ ...current, payload: next })); }
  function updateLocalized(field: "summary" | "tagline" | "description", locale: "zh" | "en", value: string) { const payload = draft.payload as Record<string, unknown>; const current = payload[field] as Record<string, string> | undefined; updatePayload({ ...payload, [field]: { ...(current || { zh: "", en: "" }), [locale]: value } } as CuratorContentItem["payload"]); }
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const payload = draft.payload as Record<string, unknown>;
    const summary = payload.summary as { zh?: string; en?: string } | undefined;
    if (!draft.title.trim()) next.title = "请填写标题";
    if (!draft.slug.trim()) next.slug = "请填写 Slug";
    for (const [index, link] of ((payload.links || []) as Array<{ label?: string; url?: string }>).entries()) {
      if (!String(link.label || "").trim() || !String(link.url || "").trim()) { next.links = `第 ${index + 1} 条相关链接需要同时填写名称和地址`; break; }
      try { const url = new URL(String(link.url)); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { next.links = `第 ${index + 1} 条相关链接不是完整的 http 或 https 地址`; break; }
    }
    if (draft.status !== "active") return next;
    if (!draft.category) next.category = "请选择一个分类";
    if (!String(summary?.zh || "").trim()) next.summaryZh = "请填写中文简介";
    if (!String(summary?.en || "").trim()) next.summaryEn = "请填写 English summary";
    if (block === "tool") {
      const tool = payload as unknown as ToolPayload;
      if (!tool.tagline.zh.trim()) next.taglineZh = "请填写中文定位";
      if (!tool.tagline.en.trim()) next.taglineEn = "请填写 English verdict";
      try { const url = new URL(tool.url); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { next.toolUrl = "请输入完整的 http 或 https 链接"; }
    }
    if ((block === "skill" || block === "project") && !String(payload.body || "").trim()) next.body = "已发布的长文必须填写正文";
    if (block === "prompt" && !String(payload.prompt || "").trim()) next.prompt = "已发布的提示词必须填写正文";
    return next;
  }
  function focusFirstError() { requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [data-validation-error="true"]')?.focus()); }
  async function save() {
    const validation = validate(); setFieldErrors(validation);
    if (Object.keys(validation).length) { setError("请先处理表单中标出的内容"); focusFirstError(); return; }
    setBusy(true); setError("");
    try { const normalized = { ...draft, id: draft.id || draft.slug, slug: draft.slug.trim(), title: draft.title.trim() }; const result = await curatorRequest<{ item: CuratorContentItem }>("/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: normalized, revisionId: original?.revision?.id }) }); setOriginal(result.item); setDraft(structuredClone(result.item)); if (isNew || slug !== result.item.slug) router.replace(curatorEditorHref(block, result.item.slug)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); } finally { setBusy(false); }
  }
  function archive() { setConfirm(null); setDraft((current) => ({ ...current, status: "archived" })); }
  async function remove() { setBusy(true); setError(""); try { await curatorRequest(`/content/${encodeURIComponent(draft.id)}?revisionId=${original?.revision?.id ?? ""}`, { method: "DELETE" }); router.push(`/curator/resources/?block=${block}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "删除失败"); setBusy(false); } }

  if (loading) return <Stack gap="md"><Skeleton h={42} w="35%" /><Skeleton h={260} /><Skeleton h={340} /></Stack>;
  if (loadError) return <Alert color="red" title="内容无法打开">
    <Stack gap="md"><Text size="sm">{loadError}</Text><Group><Button component={Link} href={`/curator/resources/?block=${block}`} variant="default">返回{BLOCK_LABELS[block]}列表</Button><Button onClick={() => window.location.reload()}>重新读取</Button></Group></Stack>
  </Alert>;
  const tool = block === "tool" ? draft.payload as ToolPayload : null;
  const article = block === "skill" || block === "project" ? draft.payload as ArticlePayload : null;
  const prompt = block === "prompt" ? draft.payload as PromptPayload : null;

  const conversationContentId = !isNew && original?.id ? original.id : null;
  const saveStatus = error || (busy ? "保存中" : dirty ? "修改中" : "已保存");

  return <div className={conversationContentId ? "curator-editor-split" : undefined}>
    {conversationContentId ? <Box className="curator-editor-chat"><ConversationPanel contentId={conversationContentId} currentPayload={conversationPayload} context={{ title: original?.title || `未命名${BLOCK_LABELS[block]}`, backHref: `/curator/resources/?block=${block}`, backLabel: `${BLOCK_LABELS[block]}列表` }} hint="这个条目还没有对话。说想改什么，Agent 会给出可逐项采用的修改。" onAdopt={(adopted) => setDraft((current) => { const { category, tags, ...payloadPatch } = adopted; return { ...current, ...(typeof category === "string" ? { category } : {}), ...(Array.isArray(tags) ? { tags: tags.map(String) } : {}), payload: { ...(current.payload as Record<string, unknown>), ...payloadPatch } as CuratorContentItem["payload"] }; })} /></Box> : null}
    <Stack gap={0} className="curator-editor-main" style={{ minWidth: 0 }}>
    <Box className="curator-editor-form-scroll">
    {!conversationContentId ? <CuratorPageHeader title={draft.title || `未命名${BLOCK_LABELS[block]}`} description={`新建${BLOCK_LABELS[block]}`} meta={<Text component={Link} href={`/curator/resources/?block=${block}`} size="sm" c="dimmed" className="curator-back-link">← 返回{BLOCK_LABELS[block]}列表</Text>} /> : null}
    <Stack gap="md">
      <EditorSection title="基本信息" description="用于资源库索引和公开站识别。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="标题" value={draft.title} error={fieldErrors.title} onChange={(event) => updateItem("title", event.currentTarget.value)} /><TextInput label="Slug" value={draft.slug} error={fieldErrors.slug} onChange={(event) => updateItem("slug", event.currentTarget.value)} /><TextInput label="来源链接" value={draft.sourceUrl || ""} onChange={(event) => updateItem("sourceUrl", event.currentTarget.value)} placeholder="https://…" /><Select label="内容状态" value={draft.status} onChange={(value) => updateItem("status", (value || "draft") as ContentStatus)} data={[{ value: "draft", label: "草稿" }, { value: "active", label: "已发布" }, { value: "archived", label: "已归档" }]} /></SimpleGrid></EditorSection>
      <EditorSection title="分类" description="决定这条内容在公开资源库中的栏目。"><CategoryPicker value={draft.category} error={fieldErrors.category} onChange={(category) => updateItem("category", category)} /></EditorSection>
      <EditorSection title="标签" description="补充描述这条内容，可多选。"><TagPicker value={draft.tags} onChange={(tags) => updateItem("tags", tags)} /></EditorSection>
      {tool ? <>
        <EditorSection title="工具入口" description="Logo 与主要访问入口。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="Logo 路径" value={tool.logo || ""} onChange={(event) => updatePayload({ ...tool, logo: event.currentTarget.value })} placeholder="/logos/…" /><TextInput label="官网链接" value={tool.url} error={fieldErrors.toolUrl} onChange={(event) => updatePayload({ ...tool, url: event.currentTarget.value })} /></SimpleGrid></EditorSection>
        <EditorSection title="卡片文案" description="列表卡片只显示定位和摘要。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="中文定位" value={tool.tagline.zh} error={fieldErrors.taglineZh} onChange={(event) => updateLocalized("tagline", "zh", event.currentTarget.value)} /><TextInput label="English verdict" value={tool.tagline.en} error={fieldErrors.taglineEn} onChange={(event) => updateLocalized("tagline", "en", event.currentTarget.value)} /><Textarea label="中文简介" minRows={3} value={tool.summary.zh} error={fieldErrors.summaryZh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={3} value={tool.summary.en} error={fieldErrors.summaryEn} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection>
        <EditorSection title="快速查看" description="点击工具卡片后显示的补充介绍。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文短详情" description="建议两小段、120–240 字。" rows={10} resize="none" value={tool.description?.zh || ""} onChange={(event) => updateLocalized("description", "zh", event.currentTarget.value)} /><Textarea label="English details" description="Two short paragraphs." rows={10} resize="none" value={tool.description?.en || ""} onChange={(event) => updateLocalized("description", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection>
      </> : null}
      {article ? <><EditorSection title="摘要" description="中英文摘要用于列表和搜索结果。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={article.summary.zh} error={fieldErrors.summaryZh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={article.summary.en} error={fieldErrors.summaryEn} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="正文" description="使用 Markdown 编写公开阅读页正文。"><MarkdownEditor value={article.body} error={fieldErrors.body} onChange={(body) => updatePayload({ ...article, body })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={article.links} error={fieldErrors.links} onChange={(links) => updatePayload({ ...article, links })} /></EditorSection></> : null}
      {prompt ? <><EditorSection title="摘要"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={prompt.summary.zh} error={fieldErrors.summaryZh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={prompt.summary.en} error={fieldErrors.summaryEn} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="提示词正文"><MarkdownEditor label="Prompt" minHeight="20rem" value={prompt.prompt} error={fieldErrors.prompt} onChange={(next) => updatePayload({ ...prompt, prompt: next })} /></EditorSection><EditorSection title="变量"><VariablesEditor value={prompt.variables} onChange={(variables) => updatePayload({ ...prompt, variables })} /></EditorSection><EditorSection title="示例"><ExamplesEditor value={prompt.examples} onChange={(examples) => updatePayload({ ...prompt, examples })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={prompt.links} error={fieldErrors.links} onChange={(links) => updatePayload({ ...prompt, links })} /></EditorSection></> : null}
    </Stack>
    </Box>
    <Paper withBorder p="sm" className="curator-savebar-mantine"><Flex align="center" justify="space-between" gap="md" wrap="wrap"><Text size="sm" fw={500} c={error ? "red" : dirty ? "orange" : "dimmed"} role={error ? "alert" : "status"} className="curator-save-status">{saveStatus}</Text><Group gap="xs">{!isNew ? <Menu position="top-end" shadow="md" withinPortal><Menu.Target><Button variant="default">更多</Button></Menu.Target><Menu.Dropdown>{draft.status !== "archived" ? <><Menu.Item onClick={() => setConfirm("archive")}>归档</Menu.Item><Menu.Divider /></> : null}<Menu.Item color="red" onClick={() => setConfirm("delete")}>删除</Menu.Item></Menu.Dropdown></Menu> : null}<Button variant="subtle" disabled={!dirty || busy} onClick={() => original && setDraft(structuredClone(original))}>放弃修改</Button><Button loading={busy} disabled={!dirty || busy} onClick={() => void save()}>保存修改</Button></Group></Flex></Paper>
    <Modal opened={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? "永久删除这条内容？" : "设为归档状态？"} centered><Text size="sm" c="dimmed">{confirm === "delete" ? "删除后无法从资源库恢复，公开派生文件也会同步移除。" : "内容会先改为归档状态，点击保存后才会从公开站移除。"}</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfirm(null)}>取消</Button><Button color={confirm === "delete" ? "red" : "curator"} onClick={() => confirm === "delete" ? void remove() : void archive()}>{confirm === "delete" ? "确认删除" : "设为归档"}</Button></Group></Modal>
    <Modal opened={Boolean(leaveHref) || leaveHistory} onClose={() => { setLeaveHref(null); setLeaveHistory(false); }} title="有修改尚未保存" centered><Text size="sm" c="dimmed">离开后，这次修改将无法恢复。</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => { setLeaveHref(null); setLeaveHistory(false); }}>留在这里</Button><Button color="red" onClick={discardAndLeave}>放弃并离开</Button></Group></Modal>
    </Stack>
  </div>;
}
