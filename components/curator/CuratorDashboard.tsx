"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Flex, Group, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { BLOCK_LABELS, curatorRequest, type ActivityEntry, type BuildJob, type CuratorIngestBlock, type CuratorRun } from "@/lib/curator-client";
import { useBuildJob } from "@/components/curator/useBuildJob";

type ContentCounts = { all: number; tool: number; skill: number; project: number; prompt: number; active: number; archived: number; issues: number; issueTotal: number };
type IssueItem = { id: string; slug: string; title: string; blockType: CuratorIngestBlock; issueCount: number; updatedAt: string };
type DashboardData = { issueItems: IssueItem[]; issuesTotal: number; counts: ContentCounts; runs: CuratorRun[]; activity: ActivityEntry[]; updatedAt: string };

function relativeTime(value: string) {
  const at = Date.parse(value); if (Number.isNaN(at)) return "—";
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "刚刚"; if (minutes < 60) return `${minutes} 分钟前`; if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function StatusRow({ tone, title, detail, action, href }: { tone: "ok" | "warn" | "error"; title: string; detail: string; action?: string; href?: string }) {
  const color = tone === "ok" ? "teal" : tone === "warn" ? "yellow" : "red";
  return <Group justify="space-between" align="center" wrap="nowrap" py="sm" className="curator-dashboard-row"><Group wrap="nowrap" gap="sm"><Box className="curator-state-dot" data-color={color} /><Box><Text fw={600} size="sm">{title}</Text><Text size="xs" c="dimmed" mt={2}>{detail}</Text></Box></Group>{action && href ? <Button component={Link} href={href} size="xs" variant="subtle" color={color}>{action}</Button> : null}</Group>;
}

export function CuratorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null); const [error, setError] = useState(""); const { build, setBuild } = useBuildJob();
  useEffect(() => {
    Promise.all([
      curatorRequest<{ items: IssueItem[]; total: number; counts: ContentCounts }>("/content?pageSize=6&issues=true&sort=updated-desc"),
      curatorRequest<{ items: CuratorRun[] }>("/runs").catch(() => ({ items: [] })), curatorRequest<{ items: ActivityEntry[] }>("/activity?limit=8").catch(() => ({ items: [] })),
      curatorRequest<{ updatedAt: string }>("/site"), curatorRequest<{ build: BuildJob }>("/health"),
    ]).then(([content, runs, activity, site, health]) => { setBuild(health.build || { status: "idle" }); setData({ issueItems: content.items || [], issuesTotal: content.total || 0, counts: content.counts, runs: runs.items || [], activity: activity.items || [], updatedAt: site.updatedAt || "" }); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "无法读取工作台"));
  }, [setBuild]);

  const counts = data?.counts; const pending = data?.runs.filter((run) => run.status === "awaiting_review") ?? []; const failedRuns = data?.runs.filter((run) => run.status === "failed") ?? [];
  return <Stack gap="xl">
    <Flex justify="space-between" align="flex-end" gap="lg" wrap="wrap" className="curator-page-heading-mantine"><Box><Text className="curator-eyebrow-mantine">Curator / 工作台</Text><Title order={1} mt={4}>今天要处理的内容</Title><Text c="dimmed" mt="xs">先处理失败和待确认内容，再继续新增收录。</Text></Box><Text size="sm" c="dimmed" className="curator-number">数据更新于 {data?.updatedAt?.replaceAll("-", ".") || "—"}</Text></Flex>
    {error ? <Alert color="red" title="工作台读取失败" role="alert">{error}</Alert> : null}

    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">{(["tool", "skill", "project", "prompt"] as CuratorIngestBlock[]).map((block) => <Paper withBorder p="lg" key={block}><Text size="sm" c="dimmed">{BLOCK_LABELS[block]}</Text>{counts ? <Title order={2} mt={8} className="curator-number">{counts[block]}</Title> : <Skeleton h={28} w={48} mt={8} />}</Paper>)}</SimpleGrid>

    <Paper withBorder p="xl"><Group justify="space-between" mb="md"><Box><Text className="curator-eyebrow-mantine">继续处理</Text><Title order={2} mt={4}>没做完的事</Title></Box>{data ? <Badge color={pending.length || failedRuns.length || build.status === "error" ? "orange" : "teal"} variant="light">{pending.length + failedRuns.length + (build.status === "error" ? 1 : 0)} 项</Badge> : null}</Group>
      {!data ? <Stack gap="xs"><Skeleton h={52} /><Skeleton h={52} /></Stack> : pending.length || failedRuns.length || build.status === "error" ? <Stack gap={0}>{pending.map((run) => <StatusRow key={run.id} tone="warn" title={run.draft?.name || run.source?.title || "资源草稿"} detail={`分析完成但还没保存 · ${relativeTime(run.updatedAt)}`} action="继续" href={`/curator/ingest/?run=${run.id}`} />)}{failedRuns.map((run) => <StatusRow key={run.id} tone="error" title={run.draft?.name || run.source?.title || run.input?.url || "资源分析"} detail={`${run.error || "分析失败"} · ${relativeTime(run.updatedAt)}`} action="查看" href={`/curator/ingest/?run=${run.id}`} />)}{build.status === "error" ? <StatusRow tone="error" title="上次构建校验失败" detail={build.error || "构建没有完成"} action="查看日志" href="/curator/settings/" /> : null}</Stack> : <Stack align="center" py="xl" gap={4}><Text fw={600}>没有待处理的任务</Text><Text size="sm" c="dimmed">新的收录任务可以从顶栏开始。</Text></Stack>}
    </Paper>

    <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
      <Paper withBorder p="xl"><Group justify="space-between" mb="md"><Box><Text className="curator-eyebrow-mantine">内容检查</Text><Title order={2} mt={4}>{counts ? `${counts.issues} 条需要检查` : "读取中"}</Title></Box><Badge color={counts?.issueTotal ? "orange" : "teal"} variant="light">{counts?.issueTotal ? `${counts.issueTotal} 个字段` : "正常"}</Badge></Group>{data?.issueItems.length ? <Stack gap={0}>{data.issueItems.map((entry) => <StatusRow key={entry.id} tone="warn" title={entry.title} detail={`${entry.issueCount} 个字段需要检查`} action="检查" href={`/curator/resources/${entry.blockType}/${entry.slug}`} />)}</Stack> : <Text size="sm" c="dimmed" py="lg">{data ? "所有内容都通过检查" : "正在检查资源"}</Text>}{data && data.issuesTotal > data.issueItems.length ? <Button component={Link} href="/curator/resources/?issues=true" variant="subtle" mt="md">查看全部 {data.issuesTotal} 条</Button> : null}</Paper>
      <Paper withBorder p="xl"><Box mb="md"><Text className="curator-eyebrow-mantine">最近修改</Text><Title order={2} mt={4}>Curator 写入记录</Title></Box>{data?.activity.length ? <Stack gap={0}>{data.activity.slice(0, 6).map((entry, index) => <StatusRow key={`${entry.at}-${index}`} tone="ok" title={entry.message} detail={`${entry.slug || entry.type} · ${relativeTime(entry.at)}`} />)}</Stack> : <Text size="sm" c="dimmed" py="lg">还没有写入记录</Text>}</Paper>
      <Paper withBorder p="xl"><Group justify="space-between" mb="md"><Box><Text className="curator-eyebrow-mantine">构建与公开站</Text><Title order={2} mt={4}>公开站</Title></Box><Badge color={build.status === "error" ? "red" : build.status === "ok" ? "teal" : build.status === "running" ? "curator" : "gray"} variant="light">{build.status === "running" ? "校验中" : build.status === "error" ? "失败" : build.status === "ok" ? "已更新" : "未校验"}</Badge></Group><Text size="sm" c="dimmed" lh={1.6}>{counts?.issueTotal ? `${counts.issueTotal} 个待检查字段可能让构建失败，先处理它们。` : "数据校验通过，可以运行构建校验。"}</Text><SimpleGrid cols={2} mt="lg"><Box><Text size="xs" c="dimmed">在架</Text><Text fw={600} mt={4} className="curator-number">{counts ? counts.active : "—"}</Text></Box><Box><Text size="xs" c="dimmed">归档</Text><Text fw={600} mt={4} className="curator-number">{counts ? counts.archived : "—"}</Text></Box></SimpleGrid><Group mt="xl"><Button component={Link} href="/curator/settings/" variant="default">构建状态</Button><Button component="a" href={build.publicUrl || "http://localhost:3000/zh/"} target="_blank" variant="subtle">打开公开站</Button></Group></Paper>
    </SimpleGrid>
  </Stack>;
}
