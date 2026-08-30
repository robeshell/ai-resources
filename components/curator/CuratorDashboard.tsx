"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Flex, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { curatorRequest, type ActivityEntry, type BuildJob, type CuratorIngestBlock, type CuratorRun } from "@/lib/curator-client";
import { contentBlocks, ENABLED_CONTENT_BLOCK_IDS } from "@/lib/content-blocks";
import { useBuildJob } from "@/components/curator/useBuildJob";

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

const TONE_COLOR: Record<QueueTone, string> = { error: "red", warn: "yellow", info: "gray" };

function relativeTime(value: string) {
  const at = Date.parse(value); if (Number.isNaN(at)) return "—";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "刚刚"; if (minutes < 60) return `${minutes} 分钟前`; if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
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

  // One prioritized queue instead of scattered panels: build, failed and
  // pending analyses, unpublished drafts, then content issues.
  const queue: QueueRow[] = [];
  if (build.status === "error") queue.push({ key: "build", tone: "error", title: "上次构建校验失败", detail: build.error || "构建没有完成", action: "查看日志", href: "/curator/settings/" });
  for (const run of data?.runs.filter((item) => item.status === "failed") ?? []) {
    queue.push({ key: run.id, tone: "error", title: run.draft?.name || run.source?.title || run.input?.url || "资源分析", detail: `${run.error || "分析失败"} · ${relativeTime(run.updatedAt)}`, action: "重新分析", href: `/curator/ingest/?run=${run.id}` });
  }
  for (const run of data?.runs.filter((item) => item.status === "awaiting_review") ?? []) {
    queue.push({ key: run.id, tone: "warn", title: run.draft?.name || run.source?.title || "资源草稿", detail: `分析完成，确认后保存 · ${relativeTime(run.updatedAt)}`, action: "继续处理", href: `/curator/ingest/?run=${run.id}` });
  }
  for (const draft of (data?.draftItems ?? []).slice(0, 3)) {
    queue.push({ key: draft.id, tone: "info", title: draft.title, detail: `${contentBlocks[draft.blockType]?.label.zh ?? draft.blockType}草稿，发布后公开可见 · ${relativeTime(draft.updatedAt)}`, action: "去发布", href: `/curator/resources/${draft.blockType}/${encodeURIComponent(draft.slug)}` });
  }
  for (const issue of (data?.issueItems ?? []).slice(0, 3)) {
    queue.push({ key: issue.id, tone: "warn", title: issue.title, detail: `${issue.issueCount} 个字段需要补齐 · ${relativeTime(issue.updatedAt)}`, action: "去补齐", href: `/curator/resources/${issue.blockType}/${encodeURIComponent(issue.slug)}` });
  }
  const hiddenDrafts = Math.max(0, (data?.draftsTotal ?? 0) - Math.min(3, data?.draftItems.length ?? 0));
  const hiddenIssues = Math.max(0, (data?.issuesTotal ?? 0) - Math.min(3, data?.issueItems.length ?? 0));
  const counts = data?.counts;

  return <Stack gap="xl">
    <Flex justify="space-between" align="flex-end" gap="lg" wrap="wrap" className="curator-page-heading-mantine">
      <Box>
        <Text className="curator-eyebrow-mantine">Curator / 工作台</Text>
        <Title order={1} mt={4}>今天要处理的内容</Title>
        <Text c="dimmed" mt="xs">失败和待确认优先，然后是草稿与补齐。</Text>
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

    <Paper withBorder p="xl">
      <Group justify="space-between" mb="md">
        <Box>
          <Text className="curator-eyebrow-mantine">需要处理</Text>
          <Title order={2} mt={4}>按优先级排好了</Title>
        </Box>
        {data ? <Badge color={queue.length ? "orange" : "teal"} variant="light">{queue.length ? `${queue.length} 项` : "清空"}</Badge> : null}
      </Group>
      {!data ? <Stack gap="xs"><Skeleton h={52} /><Skeleton h={52} /></Stack> : queue.length ? (
        <Stack gap={0}>
          {queue.map(({ key, ...row }) => <QueueItemRow key={key} {...row} />)}
          {(hiddenDrafts > 0 || hiddenIssues > 0) && <Group gap="lg" py="sm" className="curator-dashboard-row">
            {hiddenDrafts > 0 ? <Button component={Link} href="/curator/resources/?status=draft" variant="subtle" size="xs" px={0}>全部 {data?.draftsTotal} 条草稿</Button> : null}
            {hiddenIssues > 0 ? <Button component={Link} href="/curator/resources/?issues=true" variant="subtle" size="xs" px={0}>全部 {data?.issuesTotal} 条待补齐</Button> : null}
          </Group>}
        </Stack>
      ) : (
        <Stack align="center" py="xl" gap={4}>
          <Text fw={600}>都处理完了</Text>
          <Text size="sm" c="dimmed">收录一条新资源，或运行构建校验确认公开站状态。</Text>
          <Group mt="sm">
            <Button component={Link} href="/curator/ingest/" size="xs">收录新资源</Button>
            <Button variant="default" size="xs" disabled={buildBusy || build.status === "running"} onClick={() => void runBuildCheck()}>构建校验</Button>
          </Group>
        </Stack>
      )}
    </Paper>

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
      {counts?.issueTotal ? <Text size="xs" c="dimmed" mt="sm">{counts.issueTotal} 个待补齐字段会让构建校验失败，处理后需要在系统页重新校验。</Text> : null}
    </div>

    <Paper withBorder p="xl">
      <Group justify="space-between" mb="md">
        <Box>
          <Text className="curator-eyebrow-mantine">最近修改</Text>
          <Title order={2} mt={4}>Curator 写入记录</Title>
        </Box>
        <Text size="xs" c="dimmed" className="curator-number">数据更新于 {data?.updatedAt?.replaceAll("-", ".") || "—"}</Text>
      </Group>
      {data?.activity.length ? <Stack gap={0}>
        {data.activity.slice(0, 6).map((entry, index) => <Group justify="space-between" align="center" wrap="nowrap" py="sm" className="curator-dashboard-row" key={`${entry.at}-${index}`}>
          <Group wrap="nowrap" gap="sm"><Box className="curator-state-dot" data-color="teal" /><Box maw="100%" miw={0}><Text fw={600} size="sm" truncate="end">{entry.message}</Text><Text size="xs" c="dimmed" mt={2} truncate="end">{entry.slug || entry.type}</Text></Box></Group>
          <Text size="xs" c="dimmed" style={{ flex: "0 0 auto" }}>{relativeTime(entry.at)}</Text>
        </Group>)}
      </Stack> : <Text size="sm" c="dimmed" py="lg">还没有写入记录</Text>}
    </Paper>
  </Stack>;
}
