"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Accordion, Alert, Badge, Box, Button, Flex, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { curatorRequest, type ActivityEntry, type BuildJob, type CuratorIngestBlock, type CuratorRun } from "@/lib/curator-client";
import { contentBlocks, ENABLED_CONTENT_BLOCK_IDS } from "@/lib/content-blocks";
import { useBuildJob } from "@/components/curator/useBuildJob";
import { curatorEditorHref } from "@/lib/curator-routes";

type BlockStat = { total: number; active: number; draft: number };
type ContentCounts = {
  all: number; active: number; archived: number; draft: number;
  issues: number; issueTotal: number;
  tool: number; skill: number; project: number; prompt: number;
  blocks?: Partial<Record<CuratorIngestBlock, BlockStat>>;
};
type ListItem = { id: string; slug: string; title: string; blockType: CuratorIngestBlock; updatedAt: string; issueCount?: number };
type DashboardData = {
  issueItems: ListItem[]; issuesTotal: number; counts: ContentCounts;
  draftItems: ListItem[]; draftsTotal: number;
  runs: CuratorRun[]; activity: ActivityEntry[]; updatedAt: string;
};

type QueueTone = "error" | "warn" | "info";
type QueueRow = { key: string; tone: QueueTone; title: string; detail: string; action: string; href: string };
/** A folded group: the label and count are always readable, the rows are not. */
type Bucket = { id: string; label: string; total: number; rows: QueueRow[]; moreHref?: string };

const TONE_COLOR: Record<QueueTone, string> = { error: "red", warn: "yellow", info: "gray" };
/** How many rows an expanded group shows before deferring to the library. */
const BUCKET_PREVIEW = 5;

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
 * conversation on the ingest page. Without a conversation there is nothing to
 * resume, so the ingest page opens a new one.
 */
function runHref(run: CuratorRun) {
  const contentId = run.input?.contentId;
  if (contentId) return `/curator/resources/${run.input?.block ?? "tool"}/${encodeURIComponent(contentId)}`;
  const conversationId = run.input?.conversationId;
  return conversationId ? `/curator/ingest/?conversation=${encodeURIComponent(conversationId)}` : "/curator/ingest/";
}

function QueueItemRow({ tone, title, detail, action, href }: QueueRow) {
  return <Group justify="space-between" align="center" wrap="nowrap" py="sm" className="curator-dashboard-row">
    <Group wrap="nowrap" gap="sm">
      <Box className="curator-state-dot" data-color={TONE_COLOR[tone]} />
      <Box maw="100%" miw={0}>
        <Text fw={600} size="sm" truncate="end">{title}</Text>
        <Text size="xs" c="dimmed" mt={2} truncate="end">{detail}</Text>
      </Box>
    </Group>
    <Button component={Link} href={href} size="xs" variant="subtle" color={TONE_COLOR[tone]} style={{ flex: "0 0 auto" }}>{action}</Button>
  </Group>;
}

export function CuratorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [buildBusy, setBuildBusy] = useState(false);
  const { build, setBuild } = useBuildJob();

  useEffect(() => {
    Promise.all([
      curatorRequest<{ items: ListItem[]; total: number; counts: ContentCounts }>("/content?pageSize=6&issues=true&sort=updated-desc"),
      curatorRequest<{ items: ListItem[]; total: number }>("/content?status=draft&sort=updated-desc").catch(() => ({ items: [], total: 0 })),
      curatorRequest<{ items: CuratorRun[] }>("/runs").catch(() => ({ items: [] })),
      curatorRequest<{ items: ActivityEntry[] }>("/activity?limit=8").catch(() => ({ items: [] })),
      curatorRequest<{ updatedAt: string }>("/site"),
      curatorRequest<{ build: BuildJob }>("/health"),
    ]).then(([content, drafts, runs, activity, site, health]) => {
      setBuild(health.build || { status: "idle" });
      setData({
        issueItems: content.items || [], issuesTotal: content.total || 0, counts: content.counts,
        draftItems: drafts.items || [], draftsTotal: drafts.total || 0,
        runs: runs.items || [], activity: activity.items || [], updatedAt: site.updatedAt || "",
      });
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "无法读取工作台"));
  }, [setBuild]);

  const runBuildCheck = useCallback(async () => {
    setBuildBusy(true);
    try {
      setBuild(await curatorRequest<BuildJob>("/build", { method: "POST" }));
      notifications.show({ message: "构建校验已开始", color: "teal" });
    } catch (caught) {
      notifications.show({ message: caught instanceof Error ? caught.message : "构建校验没有开始", color: "red" });
    } finally { setBuildBusy(false); }
  }, [setBuild]);

  // Failures stay in the open — everything else is folded away behind a labelled
  // count, so the page reads the same whether the library holds six items or six
  // hundred.
  const failedRuns = data?.runs.filter((item) => item.status === "failed") ?? [];
  const pendingRuns = data?.runs.filter((item) => item.status === "awaiting_review") ?? [];
  // Drafts and content issues are two separate queries over the same library, so
  // an unpublished draft with empty fields matches both. Publishing it would be
  // refused, so it belongs in one bucket only — 待补齐, the step that unblocks it.
  const issueIds = new Set((data?.issueItems ?? []).map((item) => item.id));
  const pureDrafts = (data?.draftItems ?? []).filter((item) => !issueIds.has(item.id));

  const buckets: Bucket[] = [];
  if (data?.issueItems.length) {
    buckets.push({
      id: "issues", label: "内容待补齐", total: data.issuesTotal, moreHref: "/curator/resources/?issues=true",
      rows: data.issueItems.slice(0, BUCKET_PREVIEW).map((issue) => ({
        key: `issue:${issue.id}`, tone: "warn", title: issue.title,
        detail: `${issue.issueCount} 个字段需要补齐 · ${relativeTime(issue.updatedAt)}`,
        action: "去补齐", href: curatorEditorHref(issue.blockType, issue.slug),
      })),
    });
  }
  if (pureDrafts.length) {
    buckets.push({
      id: "drafts", label: "草稿未发布", total: pureDrafts.length, moreHref: "/curator/resources/?status=draft",
      rows: pureDrafts.slice(0, BUCKET_PREVIEW).map((draft) => ({
        key: `draft:${draft.id}`, tone: "info", title: draft.title,
        detail: `${contentBlocks[draft.blockType]?.label.zh ?? draft.blockType}草稿，发布后公开可见 · ${relativeTime(draft.updatedAt)}`,
        action: "去发布", href: curatorEditorHref(draft.blockType, draft.slug),
      })),
    });
  }
  if (pendingRuns.length) {
    buckets.push({
      id: "runs", label: "分析待确认", total: pendingRuns.length,
      rows: pendingRuns.slice(0, BUCKET_PREVIEW).map((run) => ({
        key: `run:${run.id}`, tone: "warn", title: runTitle(run),
        detail: `分析完成 · ${relativeTime(run.updatedAt)}`,
        action: "继续处理", href: runHref(run),
      })),
    });
  }
  const pendingTotal = buckets.reduce((total, bucket) => total + bucket.total, 0);
  const counts = data?.counts;

  return <Stack gap="xl">
    <Flex justify="space-between" align="flex-end" gap="lg" wrap="wrap" className="curator-page-heading-mantine">
      <Box>
        <Text className="curator-eyebrow-mantine">Curator / 工作台</Text>
        <Title order={1} mt={4}>今天要处理的内容</Title>
      </Box>
      <Group gap="sm" wrap="wrap">
        <Button component={Link} href="/curator/ingest/">收录新资源</Button>
        <Button variant="default" disabled={buildBusy || build.status === "running"} onClick={() => void runBuildCheck()}>
          {build.status === "running" ? "校验中…" : "构建校验"}
        </Button>
        <Button component="a" href={build.publicUrl || "http://localhost:3000/zh/"} target="_blank" variant="subtle">打开公开站</Button>
      </Group>
    </Flex>

    {error ? <Alert color="red" title="工作台读取失败" role="alert">{error}</Alert> : null}

    {build.status === "error" ? <Alert color="red" title="上次构建校验失败" role="alert">
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Text size="sm" lineClamp={2}>{build.error || "构建没有完成"}</Text>
        <Button component={Link} href="/curator/settings/" size="xs" variant="white" color="red" style={{ flex: "0 0 auto" }}>查看日志</Button>
      </Group>
    </Alert> : null}

    {failedRuns.length ? <Alert color="red" title={`${failedRuns.length} 次分析失败`} role="alert">
      <Stack gap="xs">
        {failedRuns.slice(0, BUCKET_PREVIEW).map((run) => (
          <Group key={run.id} justify="space-between" wrap="nowrap" gap="md">
            <Box miw={0}>
              <Text size="sm" fw={600} truncate="end">{runTitle(run)}</Text>
              <Text size="xs" lineClamp={1}>{run.error || "分析没有完成"} · {relativeTime(run.updatedAt)}</Text>
            </Box>
            <Button component={Link} href={runHref(run)} size="xs" variant="white" color="red" style={{ flex: "0 0 auto" }}>
              {run.input?.contentId ? "去编辑器重试" : "继续这次收录"}
            </Button>
          </Group>
        ))}
        {failedRuns.length > BUCKET_PREVIEW ? <Text size="xs">另有 {failedRuns.length - BUCKET_PREVIEW} 次，在系统页可以清理运行记录</Text> : null}
      </Stack>
    </Alert> : null}

    <div>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Box>
          <Text className="curator-eyebrow-mantine">内容概览</Text>
          <Title order={2} mt={4}>各板块发布中与草稿</Title>
        </Box>
        {counts ? <Group gap="xs"><Badge variant="light" color="teal">发布中 {counts.active}</Badge><Badge variant="light" color="gray">草稿 {counts.draft ?? "—"}</Badge><Badge variant="light" color="red">归档 {counts.archived}</Badge></Group> : null}
      </Group>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {ENABLED_CONTENT_BLOCK_IDS.map((block) => {
          const stat = counts?.blocks?.[block];
          return <Paper withBorder p="lg" key={block}>
            <Text size="sm" c="dimmed">{contentBlocks[block].label.zh}</Text>
            <Title order={2} mt={8} className="curator-number">{stat ? stat.active : counts ? counts[block] : <Skeleton h={28} w={48} />}</Title>
            <Group gap="xs" mt={6} wrap="nowrap">
              {stat
                ? <><Text size="xs" c="dimmed">共 {stat.total}</Text>{stat.draft > 0 ? <Badge size="xs" variant="light" color="gray">{stat.draft} 草稿</Badge> : null}</>
                : null}
            </Group>
          </Paper>;
        })}
      </SimpleGrid>
    </div>

    <div>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Box>
          <Text className="curator-eyebrow-mantine">待办与记录</Text>
          <Title order={2} mt={4}>{!data ? "读取中" : pendingTotal ? `${pendingTotal} 项等你处理` : "没有待处理的内容"}</Title>
        </Box>
        <Text size="xs" c="dimmed" className="curator-number">数据更新于 {data?.updatedAt?.replaceAll("-", ".") || "—"}</Text>
      </Group>
      {!data ? <Stack gap="xs"><Skeleton h={52} /><Skeleton h={52} /></Stack> : (
        <Accordion variant="separated" multiple chevronPosition="right">
          {buckets.map((bucket) => (
            <Accordion.Item value={bucket.id} key={bucket.id}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" pr="sm">
                  <Text fw={600} size="sm">{bucket.label}</Text>
                  <Badge variant="light" color="orange">{bucket.total}</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={0}>
                  {bucket.rows.map(({ key, ...row }) => <QueueItemRow key={key} {...row} />)}
                  {bucket.moreHref && bucket.total > bucket.rows.length ? (
                    <Group py="sm" className="curator-dashboard-row">
                      <Button component={Link} href={bucket.moreHref} variant="subtle" size="xs" px={0}>在资源库看全部 {bucket.total} 条</Button>
                    </Group>
                  ) : null}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
          <Accordion.Item value="activity">
            <Accordion.Control>
              <Group justify="space-between" wrap="nowrap" pr="sm">
                <Text fw={600} size="sm">最近修改</Text>
                <Badge variant="light" color="gray">{data.activity.length}</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {data.activity.length ? <Stack gap={0}>
                {data.activity.slice(0, 6).map((entry, index) => <Group justify="space-between" align="center" wrap="nowrap" py="sm" className="curator-dashboard-row" key={`${entry.at}-${index}`}>
                  <Group wrap="nowrap" gap="sm"><Box className="curator-state-dot" data-color="teal" /><Box maw="100%" miw={0}><Text fw={600} size="sm" truncate="end">{entry.message}</Text><Text size="xs" c="dimmed" mt={2} truncate="end">{entry.slug || entry.type}</Text></Box></Group>
                  <Text size="xs" c="dimmed" style={{ flex: "0 0 auto" }}>{relativeTime(entry.at)}</Text>
                </Group>)}
              </Stack> : <Text size="sm" c="dimmed" py="sm">还没有写入记录</Text>}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}
    </div>
  </Stack>;
}
