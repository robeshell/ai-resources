"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type DataMessagePartComponent,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { Alert, Badge, Box, Button, Group, Loader, Select, Stack, Text, Title } from "@mantine/core";
import { MarkdownBody } from "@/components/MarkdownBody";
import {
  curatorEventUrl,
  curatorRequest,
  draftPayload,
  PHASE_LABEL,
  type AgentInfo,
  type AgentTool,
  type Conversation,
  type ConversationMessage,
  type CuratorDraft,
  type CuratorIngestBlock,
  type CuratorRun,
  type CuratorRunEvent,
} from "@/lib/curator-client";

type Props = {
  contentId?: string;
  /** Reopen a specific unbound conversation (a failed ingest resumed from the
   *  dashboard). Ignored when `contentId` is set — that one owns its own. */
  conversationId?: string;
  ingestBlock?: CuratorIngestBlock;
  currentPayload?: Record<string, unknown>;
  context?: {
    title: string;
    backHref: string;
    backLabel: string;
  };
  onAdopt?: (payload: Record<string, unknown>) => void;
  onSaved?: (saved: { slug: string; blockType: CuratorIngestBlock; message?: string }) => void;
  hint?: string;
};

type DraftResultData = {
  runId?: string;
  status?: string;
  error?: string | null;
  tool?: string;
  draft?: CuratorDraft | null;
  /** Persisted on the result message: the live progress card is gone by the
   *  time the operator reads the outcome, taking the timer with it. */
  elapsedMs?: number;
  polished?: boolean;
};

type ProgressData = {
  phase: string;
  activity: string;
  trail: string[];
  tokens: number;
  elapsed: string;
  reasoning: string;
  streamedText: string;
  tools: string[];
};

const FIELD_LABEL: Record<string, string> = {
  summary: "摘要", body: "正文", links: "相关链接", tagline: "定位",
  description: "短详情",
  prompt: "提示词", variables: "变量", examples: "示例", logo: "Logo",
  url: "官网链接", category: "二级分类", tags: "卡片标签",
};

function readableValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "（空）";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(readableValue).join("\n");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.zh === "string" || typeof record.en === "string") return [record.zh, record.en].filter(Boolean).join(" / ");
    if (typeof record.label === "string" && typeof record.url === "string") return `${record.label}：${record.url}`;
    if (typeof record.name === "string") return `${record.name}：${record.description ?? ""}`;
    if (typeof record.input === "string") return `${record.input} → ${record.output ?? ""}`;
  }
  return JSON.stringify(value, null, 2);
}

function TextPart({ text }: { text: string }) {
  return <Text size="sm" lh={1.65} style={{ whiteSpace: "pre-wrap" }}>{text}</Text>;
}

function AssistantTextPart({ text }: { text: string }) {
  return <MarkdownBody source={text} />;
}

function UserMessage() {
  return <MessagePrimitive.Root className="curator-msg curator-msg-user">
    <MessagePrimitive.Parts components={{ Text: TextPart }} />
  </MessagePrimitive.Root>;
}

function AssistantMessage({ DraftResult, AgentProgress }: {
  DraftResult: DataMessagePartComponent<DraftResultData>;
  AgentProgress: DataMessagePartComponent<ProgressData>;
}) {
  return <MessagePrimitive.Root className="curator-msg curator-msg-assistant">
    <MessagePrimitive.Parts components={{
      Text: AssistantTextPart,
      data: { by_name: { "draft-result": DraftResult, "agent-progress": AgentProgress } },
    }} />
  </MessagePrimitive.Root>;
}

function toThreadMessage(message: ConversationMessage): ThreadMessageLike {
  const common = { id: String(message.id), createdAt: new Date(message.createdAt) };
  if (message.role === "assistant" && message.kind === "run") {
    const data = message.data || {};
    const failed = data.status === "failed" || data.status === "cancelled";
    return {
      ...common,
      role: "assistant",
      content: [{ type: "data-draft-result", data }],
      status: failed
        ? { type: "incomplete", reason: data.status === "cancelled" ? "cancelled" : "error", error: data.error || message.text }
        : { type: "complete", reason: "stop" },
    };
  }
  return { ...common, role: message.role, content: [{ type: "text", text: message.text }] };
}

/** mm:ss for a finished run's total cost. */
function durationLabel(ms?: number) {
  if (!ms || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} 秒` : `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, "0")} 秒`;
}

/** mm:ss since the run started, so a slow Agent still reads as "working". */
function elapsedLabel(startedAt: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(startedAt)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function messageText(message: AppendMessage) {
  return message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
}

/** The chosen Agent is an operator preference, not content: it lives in this
 *  browser so reopening an editor does not silently fall back to the first
 *  available Agent. */
const AGENT_CHOICE_KEY = "curator.agent-choice";

function readAgentChoice(): { model?: string } {
  try {
    return JSON.parse(window.localStorage.getItem(AGENT_CHOICE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAgentChoice(model: string) {
  try {
    window.localStorage.setItem(AGENT_CHOICE_KEY, JSON.stringify({ model }));
  } catch {
    // Private windows and blocked site data just lose the preference.
  }
}

/** Declared at module scope on purpose: a component created inside the render
 *  is a new type on every render, so React remounts the whole progress block —
 *  which replayed its enter animation every time the timer ticked. */
const AgentProgress: DataMessagePartComponent<ProgressData> = ({ data }) => <div className="curator-agent-live">
  <Group gap="xs" wrap="nowrap" className="curator-agent-live-status">
    <Loader size={14} color="curator" />
    <Text size="sm" fw={500}>{data.tools.at(-1) || "思考中"}</Text>
    <Text size="xs" c="dimmed" className="curator-number" aria-hidden="true">
      {data.elapsed}{data.tokens ? ` · ${data.tokens} tokens` : ""}
    </Text>
  </Group>
  {data.reasoning ? <details className="curator-agent-thoughts" open={!data.streamedText}>
    <summary>查看思考过程</summary>
    <Text component="div" size="xs" c="dimmed" className="curator-agent-thought-text">{data.reasoning}</Text>
  </details> : null}
  {data.tools.length || data.trail.length ? <div className="curator-agent-actions" aria-label="处理过程">
    {[...data.trail, ...data.tools].slice(-4).map((line, index) => <Text key={`${index}-${line}`} size="xs" c="dimmed">{line}</Text>)}
  </div> : null}
  {data.streamedText ? <div className="curator-agent-live-text" role="status" aria-live="polite"><MarkdownBody source={data.streamedText} /></div> : null}
</div>;

export function ConversationPanel({ contentId, conversationId, ingestBlock, currentPayload = {}, context, onAdopt, onSaved, hint }: Props) {
  const mode = contentId ? "editor" : "standalone";
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const tool: AgentTool = "pi";
  const [model, setModel] = useState("");
  const [activeRun, setActiveRun] = useState<CuratorRun | null>(null);
  const [runEvents, setRunEvents] = useState<CuratorRunEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(contentId || conversationId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const running = Boolean(activeRun && ["queued", "running"].includes(activeRun.status));
  const latest = runEvents[runEvents.length - 1] ?? null;
  const streamedText = runEvents.filter((event) => event.type === "agent.log" && event.data?.stream === "text").map((event) => event.message).join("");
  const reasoning = runEvents.filter((event) => event.type === "agent.log" && event.data?.stream === "reasoning").map((event) => event.message).join("");
  const toolActivity = runEvents.filter((event) => event.type === "phase.progress" && event.data?.tool).map((event) => event.message);
  // What the Agent is doing right now, kept separate from the technical log so
  // waiting has something readable in it.
  const progressEvents = runEvents.filter((event) => event.type === "phase.progress");
  // The token counter updates every second and belongs in the header; keeping it
  // out of the trail stops the same step from being rewritten over and over.
  const trail = progressEvents.filter((event) => event.data?.kind !== "tokens").slice(-3).map((event) => event.message);
  const tokens = Number([...progressEvents].reverse().find((event) => event.data?.tokens)?.data?.tokens ?? 0);
  // The picker exposes only concrete gateway models. "默认模型" follows the
  // current CC Switch selection, whose alias resolution stays server-side.
  const modelOptions = useMemo(() => {
    const currentAgent = agents.find((agent) => agent.id === tool);
    const groups: Array<{ group: string; items: Array<{ value: string; label: string }> }> = [];
    for (const item of currentAgent?.models || []) {
      if (item.id === currentAgent?.defaultModelLabel) continue;
      const name = item.group || "模型";
      const bucket = groups.find((entry) => entry.group === name) || (groups.push({ group: name, items: [] }), groups[groups.length - 1]);
      bucket.items.push({ value: item.id, label: item.label });
    }
    return [{ group: "默认", items: [{ value: "__default__", label: currentAgent?.defaultModelLabel || "默认模型" }] }, ...groups];
  }, [agents, tool]);

  // Only ticks while a run is open, so an idle panel does not re-render.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    curatorRequest<{ tools: AgentInfo[] }>("/agents").then((payload) => {
      const tools = payload.tools || [];
      setAgents(tools);
      const saved = readAgentChoice();
      const chosen = tools.find((item) => item.id === "pi" && item.available);
      if (!chosen) return;
      const savedModel = saved.model !== undefined
        && (saved.model === "" || chosen.models.some((item) => item.id === saved.model))
        ? saved.model
        : undefined;
      setModel(savedModel ?? "");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!contentId && !conversationId) return;
    let cancelled = false;
    // Bound editors get-or-create their single conversation; a standalone panel
    // reopens the exact one it was pointed at.
    const load = contentId
      ? curatorRequest<Conversation>("/conversations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId }),
      })
      : curatorRequest<Conversation>(`/conversations/${encodeURIComponent(conversationId as string)}`);
    load.then(async (created) => {
      if (cancelled) return;
      setConversation(created);
      const lastPending = [...created.messages].reverse().find((message) => message.role === "user" && message.data?.runId);
      const hasResult = lastPending && created.messages.some((message) => message.role === "assistant" && message.data?.runId === lastPending.data?.runId);
      if (lastPending?.data?.runId && !hasResult) {
        const run = await curatorRequest<CuratorRun>(`/runs/${encodeURIComponent(lastPending.data.runId)}`).catch(() => null);
        if (run && !cancelled) setActiveRun(run);
      }
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "无法读取对话");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contentId, conversationId]);

  const activeRunId = activeRun?.id;
  useEffect(() => {
    if (!activeRunId || !running) return;
    const runId = activeRunId;
    const source = new EventSource(curatorEventUrl(runId));
    let disposed = false;
    const refreshRun = async () => {
      const current = await curatorRequest<CuratorRun>(`/runs/${runId}`);
      if (disposed) return current;
      setActiveRun(current);
      if (!["queued", "running"].includes(current.status)) {
        const conversationId = current.input?.conversationId;
        if (conversationId) setConversation(await curatorRequest<Conversation>(`/conversations/${encodeURIComponent(conversationId)}`));
        source.close();
      }
      return current;
    };
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as CuratorRunEvent;
      setRunEvents((current) => current.some((entry) => entry.sequence === next.sequence) ? current : [...current, next]);
      if (["run.completed", "run.failed", "run.cancelled"].includes(next.type)) {
        void refreshRun().catch(() => undefined);
      }
    };
    source.onerror = () => {
      void refreshRun().catch(() => undefined);
    };
    // SSE is primary; polling only closes the small race where a fast Pi reply
    // completes before the browser has fully attached its EventSource handlers.
    const poll = window.setInterval(() => { void refreshRun().catch(() => undefined); }, 1200);
    return () => { disposed = true; window.clearInterval(poll); source.close(); };
  }, [activeRunId, running]);

  async function send(append: AppendMessage) {
    const text = messageText(append);
    if (!text || busy || running) return;
    setBusy(true); setError(""); setRunEvents([]);
    try {
      let conversationId = conversation?.id;
      if (!conversationId) {
        const created = await curatorRequest<Conversation>("/conversations", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contentId ? { contentId } : {}),
        });
        setConversation(created); conversationId = created.id;
      }
      const payload = await curatorRequest<{ messages: ConversationMessage[]; run: CuratorRun }>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, model, ...(ingestBlock ? { block: ingestBlock } : {}) }),
      });
      setConversation((current) => current ? { ...current, messages: [...current.messages, ...payload.messages] } : current);
      setActiveRun(payload.run);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发送失败");
      throw caught;
    } finally { setBusy(false); }
  }

  async function cancel() {
    if (!activeRun || !running) return;
    setBusy(true);
    try {
      const cancelled = await curatorRequest<CuratorRun>(`/runs/${activeRun.id}/cancel`, { method: "POST" });
      setActiveRun(cancelled);
      const conversationId = cancelled.input?.conversationId || conversation?.id;
      if (conversationId) setConversation(await curatorRequest<Conversation>(`/conversations/${encodeURIComponent(conversationId)}`));
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "停止失败"); }
    finally { setBusy(false); }
  }

  const externalMessages = useMemo<ThreadMessageLike[]>(() => {
    const messages = (conversation?.messages || []).map(toThreadMessage);
    if (running && activeRun) {
      messages.push({
        id: `running-${activeRun.id}`, role: "assistant",
        content: [{ type: "data-agent-progress", data: {
          phase: latest ? PHASE_LABEL[latest.phase] ?? latest.phase : "思考中",
          activity: trail[trail.length - 1] || "思考中",
          trail, tokens, elapsed: elapsedLabel(activeRun.createdAt, now),
          reasoning, streamedText, tools: toolActivity,
        } }],
        status: { type: "running" }, createdAt: new Date(activeRun.createdAt),
      });
    }
    return messages;
  }, [activeRun, conversation?.messages, latest, now, reasoning, running, streamedText, tokens, toolActivity, trail]);

  const runtime = useExternalStoreRuntime({
    messages: externalMessages,
    convertMessage: (message) => message,
    isLoading: loading,
    isRunning: running,
    isSendDisabled: busy || !agents.some((agent) => agent.available),
    onNew: send,
    onCancel: cancel,
  });

  const saveDraftToCatalog = useCallback(async (draft: CuratorDraft, runId?: string) => {
    if (!runId) return;
    setBusy(true); setError("");
    try {
      const result = await curatorRequest<{ slug: string; message?: string; run: CuratorRun }>(`/runs/${encodeURIComponent(runId)}/save`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }),
      });
      setActiveRun(result.run);
      onSaved?.({ slug: result.slug || draft.slug, blockType: draft.blockType || "tool", message: result.message });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); }
    finally { setBusy(false); }
  }, [onSaved]);

  const retryRun = useCallback(async (runId?: string) => {
    if (!runId) return;
    setBusy(true); setError(""); setRunEvents([]);
    try {
      const next = await curatorRequest<CuratorRun>(`/runs/${encodeURIComponent(runId)}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }),
      });
      if (next.input?.conversationId) setConversation(await curatorRequest<Conversation>(`/conversations/${encodeURIComponent(next.input.conversationId)}`));
      setActiveRun(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "重试失败"); }
    finally { setBusy(false); }
  }, [model]);

  const DraftResult = useMemo<DataMessagePartComponent<DraftResultData>>(() => function DraftResult({ data }) {
    if (data.status === "failed" || data.status === "cancelled") {
      return <Stack gap="xs" className="curator-msg-run">
        <Group gap="xs" align="baseline" wrap="nowrap">
          <Text fw={600} size="sm" c={data.status === "cancelled" ? "dimmed" : "red"}>{data.status === "cancelled" ? "已停止" : "整理失败"}</Text>
          {data.elapsedMs ? <Text size="xs" c="dimmed" className="curator-number">{durationLabel(data.elapsedMs)}</Text> : null}
        </Group>
        {data.error ? <Text size="sm" c="dimmed">{data.error}</Text> : null}
        {data.runId ? <Button size="xs" variant="default" loading={busy} onClick={() => void retryRun(data.runId)}>重试</Button> : null}
      </Stack>;
    }
    if (!data.draft) return <Text size="sm" c="dimmed">Agent 没有返回可采用的草稿。</Text>;
    const proposed = draftPayload(data.draft, currentPayload);
    const fields = Object.keys(proposed);
    const changes = fields.filter((field) => JSON.stringify(currentPayload[field]) !== JSON.stringify(proposed[field]));
    const changedLabels = changes.map((field) => FIELD_LABEL[field] || field);
    // The diff is live against the editor, so adopting empties it. That is not
    // the same as the Agent proposing nothing — say which one it is.
    const adopted = !changes.length && fields.some((field) => proposed[field] !== undefined && proposed[field] !== "");
    return <Stack gap="sm" className="curator-msg-run">
      <Group justify="space-between" align="center">
        <Group gap="xs" align="baseline" wrap="nowrap">
          <Text fw={600} size="sm">整理完成</Text>
          {data.elapsedMs ? <Text size="xs" c="dimmed" className="curator-number">
            {durationLabel(data.elapsedMs)}{data.polished ? " · 含润色" : ""}
          </Text> : null}
        </Group>
        <Badge color={changes.length || mode !== "editor" ? "curator" : "gray"} variant="light">
          {mode !== "editor" ? "等待确认" : changes.length ? `${changes.length} 处建议` : adopted ? "已采用" : "无改动"}
        </Badge>
      </Group>
      {mode === "editor" ? <Stack gap="xs">
        {changes.length ? <>
          <Text size="xs" c="dimmed">
            {changedLabels.slice(0, 3).join("、")}{changedLabels.length > 3 ? `等 ${changedLabels.length} 个字段` : `共 ${changedLabels.length} 个字段`}有修改
          </Text>
          <div className="curator-suggestion-attachment">
            {changes.map((field) => <details key={field} className="curator-diff-row">
              <summary className="curator-diff-summary">
                <Text component="span" size="sm" fw={600}>{FIELD_LABEL[field] || field}</Text>
                <Text component="span" size="xs" c="dimmed" className="curator-diff-preview">
                  {readableValue(proposed[field]).replace(/\s+/g, " ")}
                </Text>
              </summary>
              <div className="curator-diff-body">
                <Stack gap={6}>
                  <Text className="curator-diff-label" component="div">当前内容</Text>
                  <Box className="curator-diff-value curator-diff-value-current">{readableValue(currentPayload[field])}</Box>
                  <Text className="curator-diff-label curator-diff-label-proposed" component="div">建议内容</Text>
                  <Box className="curator-diff-value curator-diff-value-proposed">{readableValue(proposed[field])}</Box>
                  <Group justify="flex-end" mt={2}>
                    <Button size="compact-xs" variant="subtle" onClick={() => onAdopt?.({ [field]: proposed[field] })}>采用此项</Button>
                  </Group>
                </Stack>
              </div>
            </details>)}
          </div>
        </> : <Text size="sm" c="dimmed">{adopted ? "这份建议已经在编辑器里了，记得保存。" : "Agent 没有改变任何字段。"}</Text>}
        {changes.length ? <Group mt={4}><Button size="xs" disabled={busy} onClick={() => onAdopt?.(Object.fromEntries(changes.map((field) => [field, proposed[field]])))}>全部采用</Button><Text size="xs" c="dimmed">采用后仍需保存编辑器</Text></Group> : null}
      </Stack> : <Stack gap="xs">
        <Text size="sm"><Text span fw={600}>名称：</Text>{data.draft.name}</Text>
        <Text size="sm"><Text span fw={600}>摘要：</Text>{data.draft.summary?.zh || data.draft.summary?.en}</Text>
        <Button size="xs" loading={busy} onClick={() => void saveDraftToCatalog(data.draft!, data.runId)}>保存为资源</Button>
      </Stack>}
    </Stack>;
  }, [busy, currentPayload, mode, onAdopt, retryRun, saveDraftToCatalog]);

  const messageComponents = useMemo(() => ({
    UserMessage,
    AssistantMessage: () => <AssistantMessage DraftResult={DraftResult} AgentProgress={AgentProgress} />,
  }), [DraftResult]);

  return <AssistantRuntimeProvider runtime={runtime}>
    <ThreadPrimitive.Root className="curator-conversation">
      {context ? <header className="curator-conversation-header">
        <Text component={Link} href={context.backHref} size="sm" c="dimmed" className="curator-back-link">← {context.backLabel}</Text>
        <Title order={2} lineClamp={1}>{context.title}</Title>
      </header> : null}
      <ThreadPrimitive.Viewport className="curator-conversation-scroll">
        {!externalMessages.length && hint ? <Text size="sm" c="dimmed" className="curator-conversation-empty">{hint}</Text> : null}
        <ThreadPrimitive.Messages components={messageComponents} />
      </ThreadPrimitive.Viewport>
      <div className="curator-conversation-controls">
        {error ? <Alert color="red" title="出错了" role="alert" mb="xs">{error}</Alert> : null}
        <ComposerPrimitive.Root className="curator-composer">
          <ComposerPrimitive.Input className="curator-composer-input" placeholder="丢一个链接，或直接说要改什么…" aria-label="发送消息" submitMode="enter" />
          <Group align="center" gap="sm" wrap="nowrap" mt="xs">
            <Select
              aria-label="模型"
              w={220}
              size="xs"
              comboboxProps={{ width: 300, position: "bottom-start" }}
              value={model || "__default__"}
              onChange={(value) => { const next = value === "__default__" || !value ? "" : value; setModel(next); writeAgentChoice(next); }}
              data={modelOptions}
              renderOption={({ option }) => <Group gap="xs" wrap="nowrap" justify="space-between" w="100%">
                <Text size="sm" truncate>{option.label}</Text>
                {option.value === "__default__" ? <Badge size="xs" variant="light" color="curator" radius="sm">默认</Badge> : null}
              </Group>}
            />
            <Box style={{ flex: 1 }} />
            {running ? <ComposerPrimitive.Cancel asChild><Button size="xs" variant="default" loading={busy}>停止</Button></ComposerPrimitive.Cancel> : <ComposerPrimitive.Send asChild><Button size="xs" loading={busy}>发送</Button></ComposerPrimitive.Send>}
          </Group>
        </ComposerPrimitive.Root>
      </div>
    </ThreadPrimitive.Root>
  </AssistantRuntimeProvider>;
}
