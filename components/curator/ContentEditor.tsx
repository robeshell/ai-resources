"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion, Alert, Badge, Box, Button, Checkbox, Drawer, Flex, Group, Modal,
  Paper, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Text, Textarea,
  TextInput, Timeline, Title,
} from "@mantine/core";
import { ExamplesEditor, StructuredLinks, VariablesEditor } from "@/components/curator/StructuredFields";
import type { ArticlePayload, ContentBlockId, ContentStatus, PromptPayload, ToolPayload } from "@/lib/content-blocks";
import { agentEventMessage, BLOCK_LABELS, PHASE_LABEL, curatorEventUrl, curatorRequest, type CuratorContentItem, type CuratorRun, type CuratorRunEvent } from "@/lib/curator-client";

type EditableBlock = Extract<ContentBlockId, "tool" | "skill" | "project" | "prompt">;
type Candidate = { id: number; payload: CuratorContentItem["payload"]; createdAt: string; createdBy: string; note: string };
type Notice = { text: string; tone: "success" | "error" } | null;
const PLATFORM_VALUES = ["web", "app", "api", "cli"] as const;

function blankPayload(block: EditableBlock): CuratorContentItem["payload"] {
  if (block === "tool") return { tagline: { zh: "", en: "" }, summary: { zh: "", en: "" }, url: "", pricing: "free", platforms: ["web"] } satisfies ToolPayload;
  if (block === "prompt") return { summary: { zh: "", en: "" }, prompt: "", variables: [], examples: [], links: [] } satisfies PromptPayload;
  return { summary: { zh: "", en: "" }, body: "", links: [] } satisfies ArticlePayload;
}

function blankItem(block: EditableBlock): CuratorContentItem {
  const at = new Date().toISOString();
  return { id: "", blockType: block, slug: "", title: "", status: "draft", tags: [], createdAt: at, updatedAt: at, payload: blankPayload(block) };
}

function publicPath(item: CuratorContentItem) { return item.blockType === "tool" ? "/zh/" : `/zh/${item.blockType}s/${item.slug}/`; }

function EditorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <Paper component="section" withBorder p={{ base: "md", sm: "xl" }}>
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing={{ base: "md", md: "xl" }}>
      <Box><Title order={2}>{title}</Title>{description ? <Text size="sm" c="dimmed" mt={6} lh={1.6}>{description}</Text> : null}</Box>
      <Box style={{ gridColumn: "span 2" }}>{children}</Box>
    </SimpleGrid>
  </Paper>;
}

function jsonValue(value: unknown) { return value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 2); }

function AgentDrawer({ item, open, onOpenChange, onAccept }: { item: CuratorContentItem; open: boolean; onOpenChange: (open: boolean) => void; onAccept: (payload: CuratorContentItem["payload"]) => void }) {
  const [note, setNote] = useState("");
  const [run, setRun] = useState<CuratorRun | null>(null);
  const [events, setEvents] = useState<CuratorRunEvent[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loadCandidates = useCallback(async () => {
    const result = await curatorRequest<{ candidates: Candidate[] }>(`/content/${encodeURIComponent(item.id)}/candidates`);
    setCandidates(result.candidates || []); setSelectedCandidate((result.candidates || [])[0] || null);
  }, [item.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open && item.id) void loadCandidates().catch(() => undefined); }, [item.id, loadCandidates, open]);
  useEffect(() => {
    if (!run || ["failed", "cancelled", "saved"].includes(run.status)) return;
    const runId = run.id;
    const source = new EventSource(curatorEventUrl(runId));
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as CuratorRunEvent;
      setEvents((current) => current.some((entry) => entry.sequence === next.sequence) ? current : [...current, next]);
      if (["run.completed", "run.failed", "run.cancelled"].includes(next.type)) { void curatorRequest<CuratorRun>(`/runs/${runId}`).then(setRun).catch(() => undefined); source.close(); }
    };
    source.onerror = () => { curatorRequest<CuratorRun>(`/runs/${runId}`).then((current) => { setRun(current); if (["awaiting_review", "failed", "cancelled", "saved"].includes(current.status)) source.close(); }).catch(() => undefined); };
    return () => source.close();
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true); setError(""); setEvents([]); setSelectedCandidate(null);
    try { setRun(await curatorRequest<CuratorRun>(`/content/${encodeURIComponent(item.id)}/reprocess`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "无法启动 Agent"); }
    finally { setBusy(false); }
  }
  async function createCandidate() {
    if (!run) return;
    setBusy(true); setError("");
    try { await curatorRequest(`/runs/${run.id}/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: run.draft }) }); await loadCandidates(); setRun((current) => current ? { ...current, status: "saved" } : current); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "候选生成失败"); }
    finally { setBusy(false); }
  }
  async function abandon(candidate: Candidate) {
    setBusy(true);
    try { await curatorRequest(`/content/${encodeURIComponent(item.id)}/candidates/${candidate.id}/abandon`, { method: "POST" }); await loadCandidates(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "放弃失败"); }
    finally { setBusy(false); }
  }

  const changes = useMemo(() => {
    if (!selectedCandidate) return [];
    const oldPayload = item.payload as Record<string, unknown>; const newPayload = selectedCandidate.payload as Record<string, unknown>;
    return Array.from(new Set([...Object.keys(oldPayload), ...Object.keys(newPayload)])).filter((key) => JSON.stringify(oldPayload[key]) !== JSON.stringify(newPayload[key]));
  }, [item.payload, selectedCandidate]);
  const running = Boolean(run && ["queued", "running"].includes(run.status));
  const warnings = events.filter((event) => event.level === "warning" || event.level === "error");
  const toolOutput = events.filter((event) => event.type === "tool.output");

  return <Drawer opened={open} onClose={() => onOpenChange(false)} position="right" size="xl" title={<Box><Text fw={600}>Agent 重新处理</Text><Text size="sm" c="dimmed" mt={2}>只生成候选，接受后仍需在编辑器中保存。</Text></Box>} overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}>
    <Stack gap="lg">
      <Textarea label="处理要求" description="说明想改什么、保留什么；留空则由 Agent 自行判断。" value={note} minRows={4} onChange={(event) => setNote(event.currentTarget.value)} />
      <Group justify="flex-end"><Button loading={busy} disabled={!item.sourceUrl} onClick={() => void start()}>开始处理</Button></Group>
      {!item.sourceUrl ? <Alert color="yellow" title="缺少来源链接">这条内容暂时无法重新处理。</Alert> : null}
      {error ? <Alert color="red" title="Agent 处理失败">{error}</Alert> : null}
      {!run && !error && !candidates.length ? <Paper withBorder p="md"><Text fw={600} size="sm">处理流程</Text><Timeline mt="md" active={-1} bulletSize={18} lineWidth={2}>
        <Timeline.Item title="读取页面"><Text size="sm" c="dimmed">按来源链接读取当前内容。</Text></Timeline.Item>
        <Timeline.Item title="生成候选"><Text size="sm" c="dimmed">按处理要求生成结构化结果。</Text></Timeline.Item>
        <Timeline.Item title="人工确认"><Text size="sm" c="dimmed">逐字段接受，再由编辑器保存。</Text></Timeline.Item>
      </Timeline></Paper> : null}
      {run ? <Paper withBorder p="md"><Stack gap="md">
        <Group justify="space-between"><Text fw={600}>{run.status === "awaiting_review" ? "候选草稿已就绪" : run.status === "saved" ? "候选已生成" : run.status === "failed" ? "处理失败" : "处理过程"}</Text><Badge color={running ? "curator" : run.status === "failed" ? "red" : "teal"}>{PHASE_LABEL[run.phase] ?? run.phase}</Badge></Group>
        <Timeline active={events.length} bulletSize={18} lineWidth={2}>{events.map((event) => <Timeline.Item key={event.sequence} color={event.level === "error" ? "red" : event.level === "warning" ? "yellow" : "teal"} title={PHASE_LABEL[event.phase] ?? event.phase}><Text size="sm" c="dimmed">{agentEventMessage(event)}</Text></Timeline.Item>)}</Timeline>
        {!events.length ? <Skeleton h={64} /> : null}
        {run.agent?.mode === "rules" ? <Alert color="yellow" title="备用草稿">{run.agent?.message || "已生成备用草稿，文案需要人工补写"}</Alert> : null}
        {warnings.length ? <Alert color="yellow" title="需要检查">{warnings.map((entry) => <Text size="sm" key={entry.sequence}>{entry.message}</Text>)}</Alert> : null}
        {toolOutput.length ? <Accordion variant="contained"><Accordion.Item value="technical"><Accordion.Control>技术输出</Accordion.Control><Accordion.Panel>{toolOutput.map((entry) => { const data = (entry.data || {}) as { stdout?: string; stderr?: string }; return <Stack key={entry.sequence} gap="xs" mb="sm"><Text size="sm" fw={600}>{entry.message}</Text>{data.stderr ? <pre className="curator-code-block">{data.stderr}</pre> : null}{data.stdout ? <pre className="curator-code-block">{data.stdout}</pre> : null}</Stack>; })}</Accordion.Panel></Accordion.Item></Accordion> : null}
        {run.status === "awaiting_review" ? <Button loading={busy} onClick={() => void createCandidate()}>生成可比较候选</Button> : null}
        {run.status === "failed" ? <Accordion variant="contained"><Accordion.Item value="error"><Accordion.Control>技术信息</Accordion.Control><Accordion.Panel><pre className="curator-code-block">{run.error || events.filter((event) => event.type === "tool.output").map((event) => agentEventMessage(event)).join("\n")}</pre></Accordion.Panel></Accordion.Item></Accordion> : null}
      </Stack></Paper> : null}
      {candidates.length ? <Stack gap="md"><Title order={3}>候选版本</Title><SegmentedControl value={selectedCandidate ? String(selectedCandidate.id) : ""} onChange={(value) => setSelectedCandidate(candidates.find((candidate) => String(candidate.id) === value) || null)} data={candidates.map((candidate) => ({ value: String(candidate.id), label: `#${candidate.id}` }))} />
        {selectedCandidate ? <Stack gap="md">{changes.length ? changes.map((field) => <Paper withBorder p="md" key={field}><Group justify="space-between" mb="sm"><Text fw={600}>{field}</Text><Badge color="curator" variant="light">已修改</Badge></Group><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm"><Box><Text size="xs" fw={600} c="dimmed" mb={4}>当前值</Text><pre className="curator-code-block">{jsonValue((item.payload as Record<string, unknown>)[field])}</pre></Box><Box><Text size="xs" fw={600} c="dimmed" mb={4}>候选值</Text><pre className="curator-code-block is-new">{jsonValue((selectedCandidate.payload as Record<string, unknown>)[field])}</pre></Box></SimpleGrid><Button mt="sm" variant="default" onClick={() => onAccept({ ...(item.payload as Record<string, unknown>), [field]: (selectedCandidate.payload as Record<string, unknown>)[field] } as CuratorContentItem["payload"])}>接受此字段</Button></Paper>) : <Text c="dimmed">候选与当前内容没有字段差异。</Text>}
          <Group><Button onClick={() => onAccept(selectedCandidate.payload)}>接受全部字段</Button><Button color="red" variant="light" loading={busy} onClick={() => void abandon(selectedCandidate)}>放弃候选</Button></Group>
        </Stack> : null}
      </Stack> : null}
    </Stack>
  </Drawer>;
}

export function ContentEditor({ block, slug }: { block: EditableBlock; slug: string }) {
  const router = useRouter(); const isNew = slug === "new";
  const [original, setOriginal] = useState<CuratorContentItem | null>(null);
  const [draft, setDraft] = useState<CuratorContentItem>(() => blankItem(block));
  const [loading, setLoading] = useState(!isNew); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null); const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null); const [agentOpen, setAgentOpen] = useState(false);
  const dirty = useMemo(() => JSON.stringify(original || blankItem(block)) !== JSON.stringify(draft), [block, draft, original]);

  useEffect(() => { if (isNew) return; curatorRequest<{ item: CuratorContentItem }>(`/content/${encodeURIComponent(slug)}`).then(({ item }) => { if (item.blockType !== block) throw new Error("内容板块与地址不一致"); setOriginal(item); setDraft(structuredClone(item)); }).catch((caught) => setNotice({ text: caught instanceof Error ? caught.message : "内容读取失败", tone: "error" })).finally(() => setLoading(false)); }, [block, isNew, slug]);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => event.preventDefault(); window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  function updateItem<K extends keyof CuratorContentItem>(key: K, value: CuratorContentItem[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  function updatePayload(next: CuratorContentItem["payload"]) { setDraft((current) => ({ ...current, payload: next })); }
  function updateLocalized(field: "summary" | "tagline" | "description", locale: "zh" | "en", value: string) { const payload = draft.payload as Record<string, unknown>; const current = payload[field] as Record<string, string> | undefined; updatePayload({ ...payload, [field]: { ...(current || { zh: "", en: "" }), [locale]: value } } as CuratorContentItem["payload"]); }
  async function save() {
    setBusy(true); setNotice(null);
    try { const normalized = { ...draft, id: draft.id || draft.slug, slug: draft.slug.trim(), title: draft.title.trim() }; const result = await curatorRequest<{ item: CuratorContentItem; message: string }>("/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: normalized, revisionId: original?.revision?.id }) }); setOriginal(result.item); setDraft(structuredClone(result.item)); setNotice({ text: result.message, tone: "success" }); if (isNew || slug !== result.item.slug) router.replace(`/curator/resources/${block}/${encodeURIComponent(result.item.slug)}`); }
    catch (caught) { setNotice({ text: caught instanceof Error ? caught.message : "保存失败", tone: "error" }); } finally { setBusy(false); }
  }
  function archive() { setConfirm(null); setDraft((current) => ({ ...current, status: "archived" })); }
  async function remove() { setBusy(true); try { await curatorRequest(`/content/${encodeURIComponent(draft.id)}`, { method: "DELETE" }); router.push(`/curator/resources/?block=${block}`); } catch (caught) { setNotice({ text: caught instanceof Error ? caught.message : "删除失败", tone: "error" }); setBusy(false); } }

  if (loading) return <Stack gap="md"><Skeleton h={42} w="35%" /><Skeleton h={260} /><Skeleton h={340} /></Stack>;
  const tool = block === "tool" ? draft.payload as ToolPayload : null;
  const article = block === "skill" || block === "project" ? draft.payload as ArticlePayload : null;
  const prompt = block === "prompt" ? draft.payload as PromptPayload : null;

  return <Stack gap="lg" maw={1180} mx="auto">
    <Flex justify="space-between" align="flex-end" gap="lg" wrap="wrap" className="curator-page-heading-mantine"><Box><Text component={Link} href={`/curator/resources/?block=${block}`} size="sm" c="dimmed" className="curator-back-link">← 返回{BLOCK_LABELS[block]}列表</Text><Text className="curator-eyebrow-mantine" mt="md">{isNew ? "新建" : "编辑"}{BLOCK_LABELS[block]}</Text><Title order={1} mt={4}>{draft.title || `未命名${BLOCK_LABELS[block]}`}</Title></Box>{!isNew ? <Button variant="default" onClick={() => setAgentOpen(true)}>AI 重新处理</Button> : null}</Flex>
    {notice ? <Alert color={notice.tone === "error" ? "red" : "teal"} title={notice.tone === "error" ? "保存失败" : "已保存"} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</Alert> : null}
    <Stack gap="md">
      <EditorSection title="基本信息" description="用于资源库索引和公开站识别。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="标题" value={draft.title} onChange={(event) => updateItem("title", event.currentTarget.value)} /><TextInput label="Slug" value={draft.slug} onChange={(event) => updateItem("slug", event.currentTarget.value)} /><TextInput label="来源链接" value={draft.sourceUrl || ""} onChange={(event) => updateItem("sourceUrl", event.currentTarget.value)} placeholder="https://…" /><Select label="内容状态" value={draft.status} onChange={(value) => updateItem("status", (value || "draft") as ContentStatus)} data={[{ value: "draft", label: "草稿" }, { value: "active", label: "已发布" }, { value: "archived", label: "已归档" }]} /></SimpleGrid></EditorSection>
      {tool ? <EditorSection title="工具信息" description="工具只在公开站显示卡片和快速查看，不生成详情页。"><Stack gap="md"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><TextInput label="Logo 路径" value={tool.logo || ""} onChange={(event) => updatePayload({ ...tool, logo: event.currentTarget.value })} placeholder="/logos/…" /><TextInput label="官网链接" value={tool.url} onChange={(event) => updatePayload({ ...tool, url: event.currentTarget.value })} /><TextInput label="中文定位" value={tool.tagline.zh} onChange={(event) => updateLocalized("tagline", "zh", event.currentTarget.value)} /><TextInput label="English verdict" value={tool.tagline.en} onChange={(event) => updateLocalized("tagline", "en", event.currentTarget.value)} /><Textarea label="中文简介" minRows={3} value={tool.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={3} value={tool.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /><Select label="定价" value={tool.pricing} onChange={(value) => updatePayload({ ...tool, pricing: (value || "free") as ToolPayload["pricing"] })} data={[{ value: "free", label: "免费" }, { value: "freemium", label: "免费增值" }, { value: "paid", label: "付费" }, { value: "api", label: "API 计费" }]} /></SimpleGrid><Checkbox.Group label="平台" value={tool.platforms} onChange={(platforms) => updatePayload({ ...tool, platforms: platforms as ToolPayload["platforms"] })}><Group mt="xs">{PLATFORM_VALUES.map((platform) => <Checkbox key={platform} value={platform} label={platform.toUpperCase()} />)}</Group></Checkbox.Group></Stack></EditorSection> : null}
      {article ? <><EditorSection title="摘要" description="中英文摘要用于列表和搜索结果。"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={article.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={article.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="正文" description="使用 Markdown 编写公开阅读页正文。"><Textarea className="curator-markdown-input" label="Markdown" minRows={24} value={article.body} onChange={(event) => updatePayload({ ...article, body: event.currentTarget.value })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={article.links} onChange={(links) => updatePayload({ ...article, links })} /></EditorSection></> : null}
      {prompt ? <><EditorSection title="摘要"><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md"><Textarea label="中文摘要" minRows={4} value={prompt.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} /><Textarea label="English summary" minRows={4} value={prompt.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} /></SimpleGrid></EditorSection><EditorSection title="提示词正文"><Textarea className="curator-markdown-input" label="Prompt" minRows={18} value={prompt.prompt} onChange={(event) => updatePayload({ ...prompt, prompt: event.currentTarget.value })} /></EditorSection><EditorSection title="变量"><VariablesEditor value={prompt.variables} onChange={(variables) => updatePayload({ ...prompt, variables })} /></EditorSection><EditorSection title="示例"><ExamplesEditor value={prompt.examples} onChange={(examples) => updatePayload({ ...prompt, examples })} /></EditorSection><EditorSection title="相关链接"><StructuredLinks value={prompt.links} onChange={(links) => updatePayload({ ...prompt, links })} /></EditorSection></> : null}
    </Stack>
    <Paper withBorder p="sm" className="curator-savebar-mantine"><Flex align="center" justify="space-between" gap="md" wrap="wrap"><Badge color={dirty ? "orange" : "teal"} variant="light">{dirty ? "有未保存修改" : "已保存"}</Badge><Group gap="xs">{!isNew ? <Button color="red" variant="subtle" onClick={() => setConfirm("delete")}>删除</Button> : null}{draft.status !== "archived" && !isNew ? <Button variant="default" onClick={() => setConfirm("archive")}>归档</Button> : null}<Button variant="subtle" disabled={!dirty || busy} onClick={() => original && setDraft(structuredClone(original))}>放弃修改</Button>{draft.status === "active" && draft.slug ? <Button component={Link} href={publicPath(draft)} target="_blank" variant="subtle">打开公开站</Button> : null}<Button loading={busy} disabled={!dirty || !draft.title.trim() || !draft.slug.trim()} onClick={() => void save()}>保存修改</Button></Group></Flex></Paper>
    {!isNew ? <AgentDrawer item={draft} open={agentOpen} onOpenChange={setAgentOpen} onAccept={(payload) => { updatePayload(payload); setAgentOpen(false); setNotice({ text: "已将候选载入编辑器，请检查后保存。", tone: "success" }); }} /> : null}
    <Modal opened={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? "永久删除这条内容？" : "归档这条内容？"} centered><Text size="sm" c="dimmed">{confirm === "delete" ? "删除后无法从资源库恢复，公开派生文件也会同步移除。" : "归档后内容不会出现在公开站，保存后生效。"}</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfirm(null)}>取消</Button><Button color={confirm === "delete" ? "red" : "curator"} onClick={() => confirm === "delete" ? void remove() : void archive()}>{confirm === "delete" ? "确认删除" : "确认归档"}</Button></Group></Modal>
  </Stack>;
}
