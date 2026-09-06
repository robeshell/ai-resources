"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Group, Skeleton, Stack, Tabs, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { CuratorPageHeader } from "@/components/curator/CuratorPageHeader";
import { curatorRequest, type BuildJob, type CuratorIngestBlock, type CuratorRun } from "@/lib/curator-client";
import { contentBlocks, ENABLED_CONTENT_BLOCK_IDS } from "@/lib/content-blocks";
import { useBuildJob } from "@/components/curator/useBuildJob";
import { curatorEditorHref } from "@/lib/curator-routes";

type BlockStat = { total: number; active: number; draft: number };
type ContentCounts = {
  all: number; active: number; archived: number; draft: number;
  issues: number; issueTotal: number;
  tool: number; skill: number; project: number; site: number; prompt: number;
  blocks?: Partial<Record<CuratorIngestBlock, BlockStat>>;
};
type ListItem = { id: string; slug: string; title: string; blockType: CuratorIngestBlock; updatedAt: string; issueCount?: number };
type DashboardData = {
  issueItems: ListItem[]; issuesTotal: number; counts: ContentCounts;
  draftItems: ListItem[]; draftsTotal: number;
  runs: CuratorRun[]; recent: ListItem[]; updatedAt: string;
};

type QueueTone = "error" | "warn" | "info";
type QueueRow = { key: string; tone: QueueTone; title: string; detail: string; action: string; href: string };
/** Each queue is a separate workflow; their totals may overlap. */
type Bucket = { id: string; label: string; description: string; total: number; rows: QueueRow[]; moreHref?: string };

const TONE_COLOR: Record<QueueTone, string> = { error: "red", warn: "yellow", info: "gray" };
const QUEUE_PAGE_SIZE = 4;

function relativeTime(value: string) {
  const at = Date.parse(value); if (Number.isNaN(at)) return "—";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "刚刚"; if (minutes < 60) return `${minutes} 分钟前`; if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function runTitle(run: CuratorRun) {
  return run.draft?.name || run.source?.title || run.input?.url || "资源分析";
}

/**
 * Where a run can actually be picked up again. A reprocess lives in the
 * editor of the content it belongs to; a fresh ingest lives in its own
 * conversation on the ingest page. Legacy runs may predate conversations; the
 * ingest page adopts those runs before opening them.
 */
function runHref(run: CuratorRun) {
  const contentId = run.input?.contentId;
  if (contentId) return `/curator/resources/${run.input?.block ?? "tool"}/${encodeURIComponent(contentId)}`;
  const conversationId = run.input?.conversationId;
  return conversationId
    ? `/curator/ingest/?conversation=${encodeURIComponent(conversationId)}`
    : `/curator/ingest/?resume=${encodeURIComponent(run.id)}`;
}

function QueueItemRow({ tone, title, detail, action, href }: QueueRow) {
  return <Group justify="space-between" align="center" wrap="nowrap" py="sm" className="curator-dashboard-row">
    <Group wrap="nowrap" gap="sm" miw={0} flex={1}>
      <Box className="curator-state-dot" data-color={TONE_COLOR[tone]} />
      <Box maw="100%" miw={0}>
        <Text fw={500} size="sm" truncate="end">{title}</Text>
        <Text size="xs" c="dimmed" mt={2} truncate="end">{detail}</Text>
      </Box>
    </Group>
    <Button component={Link} href={href} size="xs" variant="subtle" color={TONE_COLOR[tone]} style={{ flex: "0 0 auto" }}>{action}</Button>
  </Group>;
}

function QueueSkeleton() {
  return <div aria-label="正在读取待办" role="status">{Array.from({ length: QUEUE_PAGE_SIZE }, (_, index) => <div className="curator-home-skeleton-row" key={index}><Stack gap={8} flex={1}><Skeleton h={12} w={`${52 + index * 7}%`} /><Skeleton h={12} w="34%" /></Stack><Skeleton h={12} w={48} /></div>)}</div>;
}

export function CuratorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(0);
  const [buildBusy, setBuildBusy] = useState(false);
  const { build, setBuild } = useBuildJob();

  useEffect(() => {
    let active = true;
    Promise.all([
      curatorRequest<{ items: ListItem[]; total: number; counts: ContentCounts }>("/content?pageSize=20&issues=true&sort=updated-desc"),
      curatorRequest<{ items: ListItem[]; total: number }>("/content?pageSize=20&status=draft&sort=updated-desc"),
      curatorRequest<{ items: CuratorRun[] }>("/runs"),
      curatorRequest<{ items: ListItem[] }>("/content?pageSize=20&sort=updated-desc"),
      curatorRequest<{ updatedAt: string }>("/site"),
      curatorRequest<{ build: BuildJob }>("/health"),
    ]).then(([content, drafts, runs, recent, site, health]) => {
      if (!active) return;
      setBuild(health.build || { status: "idle" });
      setData({
        issueItems: content.items || [], issuesTotal: content.total || 0, counts: content.counts,
        draftItems: drafts.items || [], draftsTotal: drafts.total || 0,
        runs: runs.items || [], recent: (recent.items || []).slice(0, 4), updatedAt: site.updatedAt || "",
      });
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "无法读取工作台"); });
    return () => { active = false; };
  }, [setBuild, revision]);

  const runBuildCheck = useCallback(async () => {
    setBuildBusy(true);
    try {
      setBuild(await curatorRequest<BuildJob>("/build", { method: "POST" }));
      notifications.show({ message: "构建校验已开始", color: "curator" });
    } catch (caught) {
      notifications.show({ message: caught instanceof Error ? caught.message : "构建校验没有开始", color: "red" });
    } finally { setBuildBusy(false); }
  }, [setBuild]);

  const failedRuns = data?.runs.filter((item) => item.status === "failed") ?? [];
  const pendingRuns = data?.runs.filter((item) => item.status === "awaiting_review") ?? [];
  const buckets: Bucket[] = [
    {
      id: "runs", label: "待确认", description: "核对 Agent 整理的结果，再保存到资源库。", total: pendingRuns.length,
      rows: pendingRuns.map((run) => ({ key: run.id, tone: "info", title: runTitle(run), detail: `分析完成 · ${relativeTime(run.updatedAt)}`, action: "查看结果", href: runHref(run) })),
    },
    {
      id: "issues", label: "待补齐", description: "补充缺失字段，让资源具备完整的展示内容。", total: data?.issuesTotal ?? 0, moreHref: "/curator/resources/?issues=true",
      rows: (data?.issueItems ?? []).map((item) => ({ key: item.id, tone: "warn", title: item.title, detail: `${item.issueCount ?? 0} 个字段需要补齐 · ${relativeTime(item.updatedAt)}`, action: "去补齐", href: curatorEditorHref(item.blockType, item.slug) })),
    },
    {
      id: "drafts", label: "草稿", description: "继续编辑尚未发布的资源，检查完成后再发布。", total: data?.draftsTotal ?? 0, moreHref: "/curator/resources/?status=draft",
      rows: (data?.draftItems ?? []).map((item) => ({ key: item.id, tone: "info", title: item.title, detail: `${contentBlocks[item.blockType]?.label.zh ?? item.blockType} · ${relativeTime(item.updatedAt)}`, action: "继续编辑", href: curatorEditorHref(item.blockType, item.slug) })),
    },
    {
      id: "failed-runs", label: "分析失败", description: "查看失败原因，回到原来的收录或编辑任务继续处理。", total: failedRuns.length,
      rows: failedRuns.map((run) => ({ key: run.id, tone: "error", title: runTitle(run), detail: `${run.error || "分析没有完成"} · ${relativeTime(run.updatedAt)}`, action: "查看原因", href: runHref(run) })),
    },
  ];
  const current = buckets.find((bucket) => bucket.id === selectedQueue) ?? buckets.find((bucket) => bucket.total > 0) ?? buckets[0];
  const visibleRows = current.rows.slice(queuePage * QUEUE_PAGE_SIZE, (queuePage + 1) * QUEUE_PAGE_SIZE);
  const counts = data?.counts;
  const buildLabel = build.status === "running" ? "校验进行中" : build.status === "ok" ? "上次校验通过" : build.status === "error" ? "上次校验失败" : "尚未校验";

  return <Stack gap={0} className="curator-home">
    <CuratorPageHeader title="工作台" description="接着上次的工作，或者收录一个新资源。" actions={<Button component={Link} href="/curator/ingest/">收录新资源</Button>} />
    {error ? <Alert color="red" title="工作台读取失败" role="alert" mb="lg"><Group justify="space-between"><Text size="sm">{error}</Text><Button variant="default" size="xs" onClick={() => { setError(""); setRevision((value) => value + 1); }}>重新读取</Button></Group></Alert> : null}

    <div className="curator-home-main">
      <section className="curator-home-queue" aria-labelledby="curator-queue-title" aria-busy={!data && !error}>
        <div className="curator-home-section-heading"><Title order={2} id="curator-queue-title">待处理</Title></div>
        <Tabs value={current.id} onChange={(value) => { setSelectedQueue(value); setQueuePage(0); }}>
          <Tabs.List className="curator-home-tabs" aria-label="待处理类型">{buckets.map((bucket) => <Tabs.Tab key={bucket.id} value={bucket.id}>{bucket.label}<span>{data ? bucket.total : "—"}</span></Tabs.Tab>)}</Tabs.List>
          {buckets.map((bucket) => <Tabs.Panel key={bucket.id} value={bucket.id}>
            {bucket.id === current.id ? <>
              <Text size="xs" c="dimmed" className="curator-home-queue-description">{bucket.description}</Text>
              {!data ? error ? <div className="curator-home-empty">待办暂时无法显示，请重新读取。</div> : <QueueSkeleton /> : visibleRows.length ? <div className="curator-home-queue-rows">{visibleRows.map(({ key, ...row }) => <QueueItemRow key={key} {...row} />)}</div> : <div className="curator-home-empty">{bucket.id === "failed-runs" ? "没有失败的分析任务" : bucket.id === "runs" ? "没有等待确认的分析结果" : bucket.id === "issues" ? "资源字段已补齐" : "没有未发布的草稿"}</div>}
              {!data && !error ? <div className="curator-home-queue-footer" aria-hidden="true"><Skeleton h={12} w={64} /></div> : null}
              {data && bucket.total > 0 ? <div className="curator-home-queue-footer"><Text size="xs" c="dimmed">{queuePage * QUEUE_PAGE_SIZE + 1}–{queuePage * QUEUE_PAGE_SIZE + visibleRows.length} / {bucket.total}</Text>{bucket.moreHref ? <Link className="curator-inline-link" href={bucket.moreHref}>查看全部 →</Link> : bucket.rows.length > QUEUE_PAGE_SIZE ? <Group gap="xs"><Button size="xs" variant="subtle" disabled={queuePage === 0} onClick={() => setQueuePage((page) => page - 1)}>上一页</Button><Button size="xs" variant="subtle" disabled={(queuePage + 1) * QUEUE_PAGE_SIZE >= bucket.rows.length} onClick={() => setQueuePage((page) => page + 1)}>下一页</Button></Group> : null}</div> : null}
            </> : null}
          </Tabs.Panel>)}
        </Tabs>
      </section>

      <aside className="curator-home-library" aria-labelledby="curator-library-title">
        <div className="curator-home-section-heading"><Title order={2} id="curator-library-title">资源库</Title><Link href="/curator/resources/" className="curator-inline-link">全部资源 →</Link></div>
        <Text size="xs" c="dimmed" className="curator-home-library-summary">{counts ? `${counts.all} 条资源 · ${counts.active} 已发布` : error ? "概览暂不可用" : "正在读取资源概览"}</Text>
        <div className="curator-home-library-label"><span>内容类型</span><span>已发布 / 全部</span></div>
        {ENABLED_CONTENT_BLOCK_IDS.map((block) => <Link className="curator-home-library-row" href={`/curator/resources/?block=${block}`} key={block}><span>{contentBlocks[block].label.zh}</span><span className="curator-number">{counts ? <>{counts.blocks?.[block]?.active ?? counts[block]}<small> / {counts.blocks?.[block]?.total ?? counts[block]}</small></> : error ? "—" : <Skeleton component="span" h={12} w={48} />}</span></Link>)}
        <div className="curator-home-build"><div><Text size="sm" fw={500}>构建校验</Text><Text size="xs" c={build.status === "error" ? "red" : "dimmed"} role="status">{!data && !error ? "正在读取校验状态" : buildLabel}</Text></div><Button variant="default" size="xs" disabled={!data || buildBusy || build.status === "running"} onClick={() => void runBuildCheck()}>{build.status === "running" ? "校验中…" : "运行校验"}</Button></div>
        {build.status === "error" ? <Link className="curator-inline-link" href="/curator/settings/#site-build">查看失败日志 →</Link> : null}
      </aside>
    </div>

    <section className="curator-home-recent" aria-labelledby="curator-recent-title" aria-busy={!data && !error}>
      <div className="curator-home-section-heading"><Title order={2} id="curator-recent-title">继续编辑</Title><Link href="/curator/resources/?sort=updated-desc" className="curator-inline-link">最近修改 →</Link></div>
      {!data ? error ? <Text size="sm" c="dimmed">最近编辑的资源暂时无法显示。</Text> : <div className="curator-home-recent-grid">{Array.from({ length: 4 }, (_, index) => <Stack gap={12} py="md" key={index}><Skeleton h={14} w="60%" /><Skeleton h={12} w="40%" /></Stack>)}</div> : data.recent.length ? <div className="curator-home-recent-grid">{data.recent.map((item) => <Link className="curator-home-recent-item" key={item.id} href={curatorEditorHref(item.blockType, item.slug)}><span className="curator-home-recent-title">{item.title}<span aria-hidden="true">↗</span></span><span className="curator-home-recent-meta">{contentBlocks[item.blockType]?.label.zh ?? item.blockType}<span>{relativeTime(item.updatedAt)}</span></span></Link>)}</div> : <Text size="sm" c="dimmed">还没有资源，收录第一个资源后会显示在这里。</Text>}
    </section>
    {data?.updatedAt ? <Text size="xs" c="dimmed" className="curator-home-updated">内容更新于 {data.updatedAt.replaceAll("-", ".")}</Text> : null}
  </Stack>;
}
