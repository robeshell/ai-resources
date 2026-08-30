"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Box, Button, Checkbox, Flex, Stack, Group, Paper, Select, SimpleGrid, Tabs, Text, Textarea, TextInput, Title } from "@mantine/core";
import { ToolLogo } from "@/components/ToolLogo";
import { useMediaQuery } from "@/components/Transitions";
import { ExamplesEditor, StructuredLinks, VariablesEditor } from "@/components/curator/StructuredFields";
import {
  KIND_LABEL,
  PHASE_LABEL,
  curatorRequest,
  curatorEventUrl,
  type AgentInfo,
  type AgentTool,
  type CatalogItem,
  type CuratorDraft,
  type CuratorIngestBlock,
  type CuratorRun,
  type CuratorRunEvent,
  type SaveResult,
} from "@/lib/curator-client";
import { COPY_LIMITS, words } from "@/lib/curator-issues";

const platforms: CatalogItem["platforms"] = ["web", "app", "api", "cli"];

const ingestBlockLabels: Record<CuratorIngestBlock, string> = {
  tool: "工具卡片",
  skill: "技能文章",
  project: "项目文章",
  prompt: "提示词模板",
};

const defaultDraft: CuratorDraft = {
  name: "",
  slug: "",
  url: "",
  kind: "tool",
  blockType: "tool",
  pricing: "freemium",
  platforms: ["web"],
  verdict: { zh: "", en: "" },
  summary: { zh: "", en: "" },
  confidence: 0,
  rationale: "",
};

function formatRunStatus(run: CuratorRun) {
  if (run.status === "awaiting_review") return "等待确认";
  if (run.status === "saved") return "已保存";
  if (run.status === "failed") return "失败";
  if (run.status === "cancelled") return "已取消";
  return PHASE_LABEL[run.phase];
}

function hostOf(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function urlProblem(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return "请输入完整链接，例如 https://example.com";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "只支持 http 和 https 链接";
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === "[::1]") {
    return "这是本机或内网地址，公开站无法访问";
  }
  return "";
}

export function CuratorStudio() {
  const params = useSearchParams();
  const router = useRouter();
  const resumeRunId = params.get("run") || "";
  const requestedBlock = params.get("block") || "";
  const isNarrow = useMediaQuery("(max-width: 48rem)");

  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [tool, setTool] = useState<AgentTool>("codex");
  const [targetBlock, setTargetBlock] = useState<"auto" | CuratorIngestBlock>(
    requestedBlock in ingestBlockLabels ? (requestedBlock as CuratorIngestBlock) : "auto",
  );
  const [model, setModel] = useState("");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [catalog, setCatalog] = useState<Array<{ id: string; slug: string; title: string; sourceUrl?: string; payload?: { url?: string } }>>([]);
  const [recentRuns, setRecentRuns] = useState<CuratorRun[]>([]);
  const [run, setRun] = useState<CuratorRun | null>(null);
  const [events, setEvents] = useState<CuratorRunEvent[]>([]);
  const [draft, setDraft] = useState<CuratorDraft>(defaultDraft);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [workPane, setWorkPane] = useState<"process" | "draft">("process");
  const [forceStart, setForceStart] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    Promise.all([
      curatorRequest<{ tools: AgentInfo[] }>("/agents"),
      curatorRequest<{ items: Array<{ id: string; slug: string; title: string; sourceUrl?: string; payload?: { url?: string } }> }>("/content?pageSize=50"),
      curatorRequest<{ items: CuratorRun[] }>("/runs").catch(() => ({ items: [] })),
    ])
      .then(([agentData, catalogData, runsData]) => {
        const available = (agentData.tools || []).filter((item) => item.available);
        setAgents(agentData.tools || []);
        setCatalog(catalogData.items || []);
        setRecentRuns(runsData.items || []);
        if (available[0]) {
          setTool(available[0].id);
          setModel(available[0].defaultModel || available[0].models[0]?.id || "");
        }
      })
      .catch((caught) => setMessage(caught instanceof Error ? caught.message : "无法连接 Curator"));
  }, []);

  useEffect(() => {
    if (!resumeRunId) return;
    curatorRequest<CuratorRun>(`/runs/${resumeRunId}`)
      .then((current) => {
        setRun(current);
        // Retries reuse the form state; a resumed run retries with its own
        // agent/model until the operator changes them in the workspace.
        if (current.input?.tool) setTool(current.input.tool);
        if (current.input) setModel(current.input.model || "");
        if (current.input?.block) setTargetBlock(current.input.block);
        if (current.draft) {
          setDraft(current.draft);
          setWorkPane("draft");
        }
      })
      .catch(() => setMessage("找不到这次分析记录，可能已被清理。"));
  }, [resumeRunId]);

  useEffect(() => {
    if (!run) return;
    eventSourceRef.current?.close();
    const runId = run.id;
    const source = new EventSource(curatorEventUrl(runId));
    eventSourceRef.current = source;
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as CuratorRunEvent;
      setEvents((current) => current.some((item) => item.sequence === next.sequence) ? current : [...current, next]);
      if (next.type === "draft.patch" || next.type === "run.completed") {
        const nextDraft = next.data?.draft as CuratorDraft | undefined;
        if (nextDraft) setDraft(nextDraft);
      }
      if (next.type === "run.completed") setWorkPane("draft");
      if (["run.completed", "run.failed", "run.cancelled"].includes(next.type)) {
        source.close();
        curatorRequest<CuratorRun>(`/runs/${runId}`).then(setRun).catch(() => undefined);
      }
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) return;
      curatorRequest<CuratorRun>(`/runs/${runId}`).then((current) => {
        setRun(current);
        if (["awaiting_review", "failed", "cancelled", "saved"].includes(current.status)) source.close();
      }).catch(() => undefined);
    };
    return () => source.close();
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentAgent = agents.find((item) => item.id === tool);
  const agentOptions = agents.map((item) => ({ value: item.id, label: `${item.label}${item.available ? "" : "（不可用）"}`, disabled: !item.available }));
  const modelOptions = [{ value: "__default__", label: "默认模型" }, ...(currentAgent?.models || []).map((item) => ({ value: item.id, label: item.label }))];
  function switchAgent(next: AgentTool) {
    setTool(next);
    const info = agents.find((item) => item.id === next);
    setModel(info?.defaultModel || info?.models[0]?.id || "");
  }
  const running = Boolean(run && ["queued", "running"].includes(run.status));
  const warnings = events.filter((event) => event.level === "warning" || event.level === "error");
  const evidence = events.filter((event) => event.type === "evidence.added");
  const toolOutput = events.filter((event) => event.type === "tool.output");

  const duplicates = useMemo(() => {
    const value = url.trim();
    if (!value) return [];
    const host = hostOf(value);
    const normalized = value.replace(/\/+$/, "").toLowerCase();
    return catalog.filter((item) => {
      const itemUrl = item.sourceUrl || item.payload?.url || "";
      const itemHost = hostOf(itemUrl);
      return (host && itemHost === host) || itemUrl.replace(/\/+$/, "").toLowerCase() === normalized;
    });
  }, [catalog, url]);

  async function start(event: FormEvent) {
    event.preventDefault();
    const problem = urlProblem(url);
    setUrlError(problem);
    if (problem) return;
    if (duplicates.length && !forceStart) {
      setForceStart(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setEvents([]);
    setDraft({ ...defaultDraft, blockType: targetBlock === "auto" ? "tool" : targetBlock });
    setWorkPane("process");
    try {
      const created = await curatorRequest<CuratorRun>("/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, note, block: targetBlock, tool, model }),
      });
      setRun(created);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "分析没有开始");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!run) return;
    setRun(await curatorRequest<CuratorRun>(`/runs/${run.id}/cancel`, { method: "POST" }));
  }

  async function retry(fromPhase: "fetch" | "generate", overrides?: { tool: AgentTool; model: string }) {
    if (!run) return;
    setEvents([]);
    setMessage("");
    setWorkPane("process");
    setRun(await curatorRequest<CuratorRun>(`/runs/${run.id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPhase, block: targetBlock, tool: overrides?.tool ?? tool, model: overrides?.model ?? model }),
    }));
  }

  async function save() {
    if (!run) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await curatorRequest<SaveResult & { run: CuratorRun }>(`/runs/${run.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      setRun(result.run);
      const savedBlock = result.run.draft?.blockType || draftBlock;
      router.push(`/curator/resources/${savedBlock}/${encodeURIComponent(result.slug || draft.slug)}`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setUrl("");
    setNote("");
    setTargetBlock("auto");
    setRun(null);
    setEvents([]);
    setDraft(defaultDraft);
    setMessage("");
    setUrlError("");
    setForceStart(false);
  }

  function update<K extends keyof CuratorDraft>(key: K, value: CuratorDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateLocalized(field: "verdict" | "summary", locale: "zh" | "en", value: string) {
    setDraft((current) => ({ ...current, [field]: { ...current[field], [locale]: value } }));
  }

  function setDraftBlock(value: string) {
    const next = value as CuratorIngestBlock;
    setDraft((current) => ({
      ...current,
      blockType: next,
      kind: next === "project" ? "open-source" : next,
    }));
  }

  const timeline = useMemo(() => {
    const latest = new Map<CuratorRunEvent["phase"], CuratorRunEvent>();
    for (const event of events) latest.set(event.phase, event);
    return Object.entries(PHASE_LABEL).map(([phase, label]) => ({
      phase: phase as CuratorRunEvent["phase"],
      label,
      event: latest.get(phase as CuratorRunEvent["phase"]),
    }));
  }, [events]);

  const missing = [
    !draft.name.trim() && "名称",
    !draft.verdict.zh.trim() && "中文定位",
    !draft.verdict.en.trim() && "English verdict",
    !draft.summary.zh.trim() && "中文简介",
    !draft.summary.en.trim() && "English summary",
  ].filter(Boolean) as string[];

  const draftBlock = draft.blockType || (draft.kind === "open-source" ? "project" : draft.kind === "skill" || draft.kind === "prompt" ? draft.kind : "tool");
  const isLongformDraft = draftBlock === "skill" || draftBlock === "project";
  const isPromptDraft = draftBlock === "prompt";
  return (
    <section className="curator-page">
      <header className="curator-page-heading is-compact">
        <div><Text className="curator-eyebrow-mantine">新收录</Text><Title order={1} mt={4}>整理一条资源</Title></div>
        {run ? <Badge color={run.status === "failed" ? "red" : run.status === "saved" ? "teal" : "curator"} variant="light">{formatRunStatus(run)}</Badge> : null}
      </header>

      {!run ? (
        <div className="curator-ingest-start">
          <form className="curator-ingest-form" onSubmit={start}>
            <Select label="收录到板块" aria-label="收录到板块" value={targetBlock} onChange={(value) => setTargetBlock((value || "auto") as "auto" | CuratorIngestBlock)} data={[{ value: "auto", label: "自动判断" }, ...(Object.keys(ingestBlockLabels) as CuratorIngestBlock[]).map((block) => ({ value: block, label: ingestBlockLabels[block] }))]} />
            <div className="curator-url-row">
              <TextInput
                id="curator-url"
                type="url"
                label="资源链接"
                value={url}
                onChange={(event) => { setUrl(event.currentTarget.value); setUrlError(""); setForceStart(false); }}
                placeholder="https://"
                required
                autoFocus
                error={urlError || undefined}
              />
              <Button type="submit" disabled={busy || !currentAgent?.available}>
                {busy ? "正在开始" : duplicates.length && forceStart ? "仍然分析" : "分析资源"}
              </Button>
            </div>
            {duplicates.length ? (
              <Alert color="yellow">
                <div>
                  <strong>目录里已经有同域名的资源</strong>
                  <ul>
                    {duplicates.slice(0, 3).map((item) => (
                      <li key={item.slug}>
                        <Link href={`/curator/resources/${item.payload?.url ? "tool" : "project"}/${item.slug}`}>{item.title}</Link>
                        <span>{item.sourceUrl || item.payload?.url}</span>
                      </li>
                    ))}
                  </ul>
                  <span>确认不是重复收录，再点一次「仍然分析」。</span>
                </div>
              </Alert>
            ) : null}
            {!currentAgent?.available ? <Alert color="yellow">当前 Agent 不可用，先在运行设置里换一个。</Alert> : null}
            <Textarea id="curator-note" label="整理备注" description="可选" minRows={3} value={note} onChange={(event) => setNote(event.currentTarget.value)} placeholder="需要重点判断的内容" />
            <details className="curator-run-settings">
              <summary>运行设置</summary>
              <div>
                <Select label="Agent" aria-label="Agent" value={tool} onChange={(value) => value && switchAgent(value as AgentTool)} data={agentOptions} />
                <Select label="模型" aria-label="模型" value={model || "__default__"} onChange={(value) => setModel(value === "__default__" || !value ? "" : value)} data={modelOptions} />
              </div>
            </details>
          </form>

          <aside className="curator-panel">
            <header className="curator-panel-header"><div><Text className="curator-eyebrow-mantine">最近</Text><h2>最近分析</h2></div></header>
            {recentRuns.length ? (
              <ul className="curator-row-list">
                {recentRuns.slice(0, 6).map((item) => (
                  <li className="curator-row" key={item.id}>
                    <Link href={`/curator/ingest/?run=${item.id}`}>
                      <span className={`curator-row-dot ${item.status === "failed" ? "is-block" : item.status === "awaiting_review" ? "is-warn" : "is-ok"}`} aria-hidden="true" />
                      <div className="curator-row-main">
                        <strong>{item.draft?.name || item.source?.title || item.input?.url || "资源分析"}</strong>
                      </div>
                      <Badge variant="light" color={item.status === "failed" ? "red" : item.status === "awaiting_review" ? "orange" : "gray"}>{formatRunStatus(item)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <div className="curator-empty-state"><strong>暂无记录</strong></div>}
          </aside>
        </div>
      ) : (
        <div className="curator-workspace" data-pane={isNarrow ? workPane : "both"}>
          <Tabs className="curator-work-switch" value={workPane} onChange={(value) => setWorkPane((value || "process") as "process" | "draft")}>
            <Tabs.List aria-label="分析视图">
              <Tabs.Tab value="process">分析过程</Tabs.Tab>
              <Tabs.Tab value="draft">当前草稿{draft.name ? "" : "（等待中）"}</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <aside className="curator-agent-panel">
            <header className="curator-panel-header">
              <div><Text className="curator-eyebrow-mantine">{run.agent?.mode === "rules" ? "规则草稿" : run.agent?.model || currentAgent?.label || "Agent"}</Text><h2>分析过程</h2></div>
              {running ? <Button type="button" variant="default" onClick={cancel}>取消分析</Button> : null}
            </header>
            {run.agent?.mode === "rules" ? (() => {
              const other = agents.find((item) => item.id !== tool && item.available);
              return <Alert color="yellow">
                <Group justify="space-between" gap="sm" wrap="wrap">
                  <Box>{run.agent?.message || "已使用规则草稿"}</Box>
                  {other ? <Button size="xs" variant="light" color="curator" style={{ flex: "0 0 auto" }} onClick={() => { const info = agents.find((item) => item.id === other.id); switchAgent(other.id as AgentTool); void retry("generate", { tool: other.id as AgentTool, model: info?.defaultModel || info?.models[0]?.id || "" }); }}>换用 {other.label} 重新生成</Button> : null}
                </Group>
              </Alert>;
            })() : null}
            <ol className="curator-timeline">
              {timeline.map((item) => {
                const active = run.phase === item.phase && running;
                const complete = Boolean(item.event && item.event.type !== "phase.started" && item.event.level !== "error");
                return (
                  <li key={item.phase} className={active ? "is-active" : complete ? "is-complete" : item.event?.level === "error" ? "is-error" : ""}>
                    <span aria-hidden="true" />
                    <div><strong>{item.label}</strong>{item.event ? <p>{item.event.message}</p> : null}</div>
                  </li>
                );
              })}
            </ol>
            {!events.length && run.status !== "queued" ? <p className="curator-panel-note">这次分析来自上一次会话，过程记录已折叠。</p> : null}
            {warnings.length ? <section className="curator-run-notes"><h3>需要检查</h3>{warnings.map((item) => <p key={item.sequence}>{item.message}</p>)}</section> : null}
            {evidence.length ? (
              <details className="curator-evidence">
                <summary>查看证据</summary>
                {evidence.map((item) => <div key={item.sequence}><strong>{item.message}</strong>{item.data ? <pre>{JSON.stringify(item.data, null, 2)}</pre> : null}</div>)}
              </details>
            ) : null}
            {toolOutput.length ? (
              <details className="curator-evidence">
                <summary>技术信息</summary>
                {toolOutput.map((item) => {
                  const data = (item.data || {}) as { stdout?: string; stderr?: string };
                  return (
                    <div key={item.sequence}>
                      <strong>{item.message}</strong>
                      {data.stderr ? <pre>{data.stderr}</pre> : null}
                      {data.stdout ? <pre>{data.stdout}</pre> : null}
                    </div>
                  );
                })}
              </details>
            ) : null}
            {!running ? (
              <Stack gap="sm" mt="md">
                <Group align="flex-end" gap="sm" wrap="wrap">
                  <Select label="Agent" aria-label="重试使用的 Agent" value={tool} onChange={(value) => value && switchAgent(value as AgentTool)} data={agentOptions} w={180} />
                  <Select label="模型" aria-label="重试使用的模型" value={model || "__default__"} onChange={(value) => setModel(value === "__default__" || !value ? "" : value)} data={modelOptions} w={240} />
                </Group>
                <Group gap="sm" wrap="wrap">
                  {run.status === "failed" || run.status === "cancelled" ? <Button type="button" onClick={() => retry("fetch")}>重新分析</Button> : null}
                  {run.status === "awaiting_review" ? <Button type="button" variant="default" onClick={() => retry("generate")}>重新生成草稿</Button> : null}
                  <Button type="button" variant="subtle" color="gray" onClick={reset}>重新开始</Button>
                </Group>
              </Stack>
            ) : null}
          </aside>

          <section className="curator-draft-panel" aria-busy={running}>
            <header className="curator-draft-header">
              <div className="curator-draft-identity">
                <ToolLogo tool={{ id: draft.slug || "draft", name: draft.name || "新资源", url: draft.url || url, logo: draft.sourceLogoUrl }} size={44} />
                <div><p>{ingestBlockLabels[draftBlock as CuratorIngestBlock] || KIND_LABEL[draft.kind as CatalogItem["kind"]]}</p><h2>{draft.name || "等待 Agent 输出"}</h2></div>
              </div>
              {draft.confidence ? <Badge variant="light" color="curator">置信度 {Math.round(draft.confidence * 100)}%</Badge> : null}
            </header>

            {draft.name ? (
              <div>
                <Paper withBorder p="md" mb="md"><Title order={3} mb="md">公开内容</Title><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput label="名称" value={draft.name} onChange={(event) => update("name", event.currentTarget.value)} />
                  <TextInput label="Slug" value={draft.slug} onChange={(event) => update("slug", event.currentTarget.value)} />
                  <TextInput label="中文定位" description={`${draft.verdict.zh.length}/${COPY_LIMITS.verdictZh} 字`} error={draft.verdict.zh.length > COPY_LIMITS.verdictZh ? "超过建议长度" : undefined} value={draft.verdict.zh} onChange={(event) => updateLocalized("verdict", "zh", event.currentTarget.value)} />
                  <TextInput label="English verdict" description={`${words(draft.verdict.en)}/${COPY_LIMITS.verdictEn} words`} error={words(draft.verdict.en) > COPY_LIMITS.verdictEn ? "超过建议长度" : undefined} value={draft.verdict.en} onChange={(event) => updateLocalized("verdict", "en", event.currentTarget.value)} />
                  <Textarea label="中文简介" description={`${draft.summary.zh.length}/${COPY_LIMITS.summaryZh} 字`} error={draft.summary.zh.length > COPY_LIMITS.summaryZh ? "超过建议长度" : undefined} minRows={3} value={draft.summary.zh} onChange={(event) => updateLocalized("summary", "zh", event.currentTarget.value)} />
                  <Textarea label="English summary" description={`${words(draft.summary.en)}/${COPY_LIMITS.summaryEn} words`} error={words(draft.summary.en) > COPY_LIMITS.summaryEn ? "超过建议长度" : undefined} minRows={3} value={draft.summary.en} onChange={(event) => updateLocalized("summary", "en", event.currentTarget.value)} />
                </SimpleGrid></Paper>
                <Paper withBorder p="md" mb="md"><Title order={3} mb="md">收录属性</Title><SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Select label="收录板块" aria-label="收录板块" value={draftBlock} onChange={(value) => setDraftBlock((value || "tool") as CuratorIngestBlock)} data={[{ value: "tool", label: "工具卡片" }, { value: "skill", label: "技能文章" }, { value: "project", label: "项目文章" }, { value: "prompt", label: "提示词模板" }]} />
                  {draftBlock === "tool" ? <Select label="定价" aria-label="定价" value={draft.pricing} onChange={(value) => update("pricing", (value || "free") as CuratorDraft["pricing"])} data={[{ value: "free", label: "免费" }, { value: "freemium", label: "免费增值" }, { value: "paid", label: "付费" }, { value: "api", label: "按量计费" }]} /> : null}
                </SimpleGrid>{draftBlock === "tool" ? <Checkbox.Group label="平台" value={draft.platforms} onChange={(value) => update("platforms", value as CatalogItem["platforms"])} mt="md"><Group mt="xs">{platforms.map((platform) => <Checkbox key={platform} value={platform} label={platform.toUpperCase()} />)}</Group></Checkbox.Group> : null}</Paper>
                {isLongformDraft ? (
                  <Paper withBorder p="md" mb="md">
                    <Title order={3} mb="md">正文（Markdown）</Title>
                    <Textarea className="curator-markdown-input" label="正文" minRows={16} value={draft.body || ""} onChange={(event) => update("body", event.currentTarget.value)} placeholder="说明它解决什么问题、怎么用、适用边界和相关链接。" />
                    <Text size="sm" fw={600} mt="lg" mb="xs">相关链接</Text>
                    <StructuredLinks value={draft.links || []} onChange={(links) => update("links", links)} />
                  </Paper>
                ) : null}
                {isPromptDraft ? (
                  <Paper withBorder p="md" mb="md">
                    <Title order={3} mb="md">提示词模板</Title>
                    <Textarea className="curator-markdown-input" label="Prompt" minRows={10} value={draft.prompt || ""} onChange={(event) => update("prompt", event.currentTarget.value)} placeholder="使用 {{variable}} 标记需要填写的变量。" />
                    <Text size="sm" fw={600} mt="lg" mb="xs">变量</Text>
                    <VariablesEditor value={draft.variables || []} onChange={(variables) => update("variables", variables)} />
                    <Text size="sm" fw={600} mt="lg" mb="xs">示例</Text>
                    <ExamplesEditor value={draft.examples || []} onChange={(examples) => update("examples", examples)} />
                    <Text size="sm" fw={600} mt="lg" mb="xs">相关链接</Text>
                    <StructuredLinks value={draft.links || []} onChange={(links) => update("links", links)} />
                  </Paper>
                ) : null}
                {draft.rationale ? <p className="curator-panel-note">Agent 判断依据：{draft.rationale}</p> : null}
              </div>
            ) : <div className="curator-draft-loading"><span /><span /><span /></div>}

            {message ? <Alert color="red" role="status">{message}</Alert> : null}
            {missing.length && draft.name ? <Alert color="yellow">还需要补齐：{missing.join("、")}</Alert> : null}
            <Paper withBorder p="sm" className="curator-savebar-mantine" mt="md">
              <Flex align="center" justify="space-between" gap="md" wrap="wrap">
                {running ? <Badge variant="light" color="gray">分析进行中</Badge> : run.status !== "awaiting_review" ? <Badge variant="light" color="gray">{formatRunStatus(run)}</Badge> : missing.length && draft.name ? <Badge variant="light" color="orange">还需补齐 {missing.length} 项</Badge> : <Badge variant="light" color="teal">草稿已就绪</Badge>}
                <Button loading={busy} disabled={running || run.status !== "awaiting_review" || missing.length > 0} onClick={() => void save()}>保存资源</Button>
              </Flex>
            </Paper>
          </section>
        </div>
      )}

      {!run && message ? <Alert color="red" role="alert">{message}</Alert> : null}
    </section>
  );
}
