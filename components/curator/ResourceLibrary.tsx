"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Badge, Box, Button, Checkbox, Flex, Group, Pagination, Paper, Select,
  Skeleton, Stack, Table, Tabs, Text, TextInput, UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { BLOCK_LABELS, curatorRequest, type CuratorContentItem } from "@/lib/curator-client";
import { contentBlocks, ENABLED_CONTENT_BLOCK_IDS, type ContentStatus, type EnabledContentBlockId } from "@/lib/content-blocks";
import { curatorEditorHref } from "@/lib/curator-routes";
import { CuratorPageHeader } from "@/components/curator/CuratorPageHeader";

type LibraryBlock = "all" | EnabledContentBlockId;
type LibraryStatus = "all" | ContentStatus;
type LibraryItem = Omit<CuratorContentItem, "blockType"> & { blockType: EnabledContentBlockId; issueCount: number };
type LibraryCounts = {
  all: number;
  active: number;
  draft: number;
  archived: number;
  issues: number;
  issueTotal: number;
  blocks: Record<EnabledContentBlockId, { total: number; active: number; draft: number }>;
};
type LibraryPage = { items: LibraryItem[]; total: number; page: number; pageSize: 20 | 50; pages: number; counts: LibraryCounts };
const BLOCKS: Array<{ value: LibraryBlock; label: string }> = [
  { value: "all", label: "全部内容" },
  ...ENABLED_CONTENT_BLOCK_IDS.map((value) => ({ value, label: contentBlocks[value].label.zh })),
];
const STATUS_LABEL: Record<ContentStatus, string> = { draft: "草稿", active: "已发布", archived: "已归档" };
const STATUS_COLOR: Record<ContentStatus, string> = { draft: "gray", active: "curator", archived: "red" };

function summaryOf(item: LibraryItem) {
  const payload = item.payload as { summary?: { zh?: string }; tagline?: { zh?: string } };
  return payload.summary?.zh || payload.tagline?.zh || item.sourceUrl || "暂无摘要";
}

function ContentIdentity({ item }: { item: LibraryItem }) {
  let source = "";
  try { source = item.sourceUrl ? new URL(item.sourceUrl).hostname.replace(/^www\./, "") : ""; } catch { source = ""; }
  return <Link href={curatorEditorHref(item.blockType, item.slug)} className="curator-content-link">
    <Stack gap={3}>
      <Text fw={600} size="sm" c="dark.8" className="curator-library-title">{item.title}</Text>
      <Text size="sm" c="dimmed" lineClamp={1}>{summaryOf(item)}</Text>
      <Text size="xs" c="dimmed" className="curator-library-source">{item.slug}{source ? ` · ${source}` : ""}</Text>
    </Stack>
  </Link>;
}

const EMPTY_COUNTS: LibraryCounts = {
  all: 0, active: 0, draft: 0, archived: 0, issues: 0, issueTotal: 0,
  blocks: { tool: { total: 0, active: 0, draft: 0 }, skill: { total: 0, active: 0, draft: 0 }, project: { total: 0, active: 0, draft: 0 }, site: { total: 0, active: 0, draft: 0 }, prompt: { total: 0, active: 0, draft: 0 } },
};

export function ResourceLibrary() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const block = (BLOCKS.some((item) => item.value === searchParams.get("block")) ? searchParams.get("block") : "all") as LibraryBlock;
  const status = (["all", "draft", "active", "archived"].includes(searchParams.get("status") || "") ? searchParams.get("status") : "all") as LibraryStatus;
  const sort = ["updated-desc", "updated-asc", "title-asc"].includes(searchParams.get("sort") || "") ? searchParams.get("sort")! : "updated-desc";
  const issues = searchParams.get("issues") === "true";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = searchParams.get("pageSize") === "50" ? 50 : 20;
  const query = searchParams.get("query") || "";
  const [search, setSearch] = useState(query);
  const [result, setResult] = useState<LibraryPage>({ items: [], total: 0, page, pageSize, pages: 1, counts: EMPTY_COUNTS });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateParams = useCallback((changes: Record<string, string | number | boolean | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === "" || value === false || value === "all" || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    router.replace(`/curator/resources/${next.size ? `?${next.toString()}` : ""}`);
  }, [router, searchParams]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ block, status, sort, page: String(page), pageSize: String(pageSize) });
      if (query) params.set("query", query);
      if (issues) params.set("issues", "true");
      const payload = await curatorRequest<LibraryPage>(`/content?${params.toString()}`);
      setResult(payload); setSelected([]);
      if (payload.page !== page) updateParams({ page: payload.page });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "资源库读取失败"); }
    finally { setLoading(false); }
  }, [block, issues, page, pageSize, query, sort, status, updateParams]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSearch(query); }, [query]);

  const allSelected = result.items.length > 0 && result.items.every((item) => selected.includes(item.id));
  const someSelected = selected.length > 0 && !allSelected;
  const createBlock = block === "all" ? "tool" : block;
  const hasFilters = block !== "all" || status !== "all" || issues || Boolean(query);
  const range = useMemo(() => {
    if (!result.total) return "0 条";
    const start = (result.page - 1) * result.pageSize + 1;
    return `${start}–${Math.min(result.page * result.pageSize, result.total)} / ${result.total} 条`;
  }, [result]);

  function submitSearch(event: FormEvent) { event.preventDefault(); updateParams({ query: search.trim(), page: 1 }); }
  function clearFilters() { setSearch(""); updateParams({ block: null, status: null, issues: null, query: null, page: 1 }); }
  function toggleAll(checked: boolean) { setSelected(checked ? result.items.map((item) => item.id) : []); }
  function toggleOne(id: string, checked: boolean) { setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id)); }
  async function batch(nextStatus: "active" | "archived") {
    if (!selected.length) return;
    setBusy(true); setError(null);
    try {
      const response = await curatorRequest<{ message: string }>("/content/batch", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, status: nextStatus }) });
      notifications.show({ message: response.message, color: "curator" }); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "批量操作失败"); }
    finally { setBusy(false); }
  }

  return <Stack gap="lg">
    <CuratorPageHeader title="资源库" description="查找、筛选和编辑内容。" actions={<Button component={Link} href={`/curator/ingest/?block=${createBlock}`}>收录{BLOCK_LABELS[createBlock]}</Button>} />

    <section className="curator-library-overview" aria-label="资源状态概览">
      {([
        { value: "all", label: "全部", count: result.counts.all },
        { value: "active", label: "已发布", count: result.counts.active },
        { value: "draft", label: "草稿", count: result.counts.draft },
        { value: "issues", label: "有问题", count: result.counts.issues },
      ] as const).map((item) => {
        const active = item.value === "issues" ? issues : status === item.value;
        return <UnstyledButton
          key={item.value}
          className="curator-library-stat"
          data-active={active || undefined}
          aria-pressed={active}
          onClick={() => item.value === "issues"
            ? updateParams({ issues: issues ? null : true, page: 1 })
            : updateParams({ status: item.value === "all" ? null : item.value, page: 1 })}
        >
          <span>{item.label}</span>
          <span className="curator-number curator-library-stat-value">{item.count}</span>
        </UnstyledButton>;
      })}
    </section>

    <Tabs value={block} onChange={(value) => updateParams({ block: value || "all", page: 1 })} variant="pills" keepMounted={false}>
      <Tabs.List className="curator-block-tabs" aria-label="按内容类型筛选">{BLOCKS.map((item) => <Tabs.Tab value={item.value} key={item.value}>{item.label}<span className="curator-tab-count">{item.value === "all" ? result.counts.all : result.counts.blocks[item.value].total}</span></Tabs.Tab>)}</Tabs.List>
    </Tabs>

    <Paper component="form" withBorder p="md" onSubmit={submitSearch} className="curator-library-filters">
      <div className="curator-library-filter-grid">
        <TextInput value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="搜索名称、Slug、链接或摘要" aria-label="搜索资源" />
        <Button type="submit" variant="default">搜索</Button>
        <Select aria-label="内容状态" value={status} onChange={(value) => updateParams({ status: value || "all", page: 1 })} data={[{ value: "all", label: "全部状态" }, { value: "draft", label: "草稿" }, { value: "active", label: "已发布" }, { value: "archived", label: "已归档" }]} />
        <Select aria-label="排序方式" value={sort} onChange={(value) => updateParams({ sort: value || "updated-desc", page: 1 })} data={[{ value: "updated-desc", label: "最近更新" }, { value: "updated-asc", label: "最早更新" }, { value: "title-asc", label: "名称 A–Z" }]} />
        {hasFilters ? <Button type="button" variant="subtle" color="gray" onClick={clearFilters}>清除筛选</Button> : null}
      </div>
    </Paper>

    {error ? <Alert color="red" title="操作失败" role="alert" withCloseButton onClose={() => setError(null)}>{error}</Alert> : null}

    <Paper withBorder p={0} className="curator-library-table-shell">
      <Group justify="space-between" p="md" mih={58} className="curator-library-resultbar">
        <Group gap="sm"><Text size="sm" fw={600} role="status" aria-live="polite">{selected.length ? `已选择 ${selected.length} 条` : "内容列表"}</Text><Text size="sm" c="dimmed" className="curator-number">{range}</Text></Group>
        {selected.length ? <Group gap="xs"><Button loading={busy} variant="default" onClick={() => void batch("active")}>发布所选</Button><Button color="red" variant="subtle" disabled={busy} onClick={() => void batch("archived")}>归档所选</Button><Button variant="subtle" color="gray" disabled={busy} onClick={() => setSelected([])}>取消选择</Button></Group> : <Text size="xs" c="dimmed">选择内容后可批量操作</Text>}
      </Group>
      {loading ? <Stack p="md" gap="xs">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} h={54} radius="sm" />)}</Stack> : null}
      {!loading && !result.items.length ? <Stack align="center" justify="center" mih={260} p="xl" gap="sm" className="curator-library-empty"><Text fw={600}>{hasFilters ? "没有匹配的内容" : "资源库还是空的"}</Text><Text size="sm" c="dimmed">{hasFilters ? "换个关键词，或者清除当前筛选。" : "从一个链接开始，Agent 会先整理成可检查的草稿。"}</Text><Group gap="xs">{hasFilters ? <Button variant="default" onClick={clearFilters}>清除筛选</Button> : null}<Button component={Link} href={`/curator/ingest/?block=${createBlock}`}>收录{BLOCK_LABELS[createBlock]}</Button></Group></Stack> : null}
      {!loading && result.items.length ? <>
        <Table.ScrollContainer minWidth={760} visibleFrom="sm"><Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th w={44}><Checkbox checked={allSelected} indeterminate={someSelected} onChange={(event) => toggleAll(event.currentTarget.checked)} aria-label="选择当前页全部内容" /></Table.Th><Table.Th>内容</Table.Th><Table.Th w={90}>类型</Table.Th><Table.Th w={100}>状态</Table.Th><Table.Th w={76}>问题</Table.Th><Table.Th w={120}>更新</Table.Th><Table.Th w={74}><span className="curator-visually-hidden">操作</span></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{result.items.map((item) => <Table.Tr key={item.id} data-selected={selected.includes(item.id) || undefined}>
            <Table.Td><Checkbox checked={selected.includes(item.id)} onChange={(event) => toggleOne(item.id, event.currentTarget.checked)} aria-label={`选择 ${item.title}`} /></Table.Td>
            <Table.Td><ContentIdentity item={item} /></Table.Td><Table.Td><Text size="sm">{BLOCK_LABELS[item.blockType as Exclude<LibraryBlock, "all">]}</Text></Table.Td>
            <Table.Td><Badge color={STATUS_COLOR[item.status]} variant="light">{STATUS_LABEL[item.status]}</Badge></Table.Td><Table.Td>{item.issueCount ? <Badge color="orange" circle>{item.issueCount}</Badge> : <Text c="dimmed">—</Text>}</Table.Td>
            <Table.Td><Text size="sm" className="curator-number">{new Date(item.updatedAt).toLocaleDateString("zh-CN")}</Text></Table.Td><Table.Td><Button component={Link} href={curatorEditorHref(item.blockType, item.slug)} variant="subtle" size="compact-sm">编辑</Button></Table.Td>
          </Table.Tr>)}</Table.Tbody>
        </Table></Table.ScrollContainer>
        <Stack hiddenFrom="sm" gap={0}>{result.items.map((item) => <Box key={item.id} p="md" className="curator-mobile-resource-row"><Group align="flex-start" wrap="nowrap">
          <Checkbox mt={3} checked={selected.includes(item.id)} onChange={(event) => toggleOne(item.id, event.currentTarget.checked)} aria-label={`选择 ${item.title}`} />
          <Stack gap="xs" flex={1}><ContentIdentity item={item} /><Group gap="xs"><Badge color="gray" variant="light">{BLOCK_LABELS[item.blockType as Exclude<LibraryBlock, "all">]}</Badge><Badge color={STATUS_COLOR[item.status]} variant="light">{STATUS_LABEL[item.status]}</Badge>{item.issueCount ? <Badge color="orange" variant="light">{item.issueCount} 个问题</Badge> : null}</Group><Group justify="space-between"><Text size="xs" c="dimmed" className="curator-number">更新于 {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</Text><Button component={Link} href={curatorEditorHref(item.blockType, item.slug)} variant="subtle" size="compact-sm">编辑</Button></Group></Stack>
        </Group></Box>)}</Stack>
      </> : null}
      <Flex justify="space-between" align="center" gap="md" wrap="wrap" p="md" className="curator-pagination-mantine">
        <Select w={130} size="sm" aria-label="每页条数" value={String(result.pageSize)} onChange={(value) => updateParams({ pageSize: value || "20", page: 1 })} data={[{ value: "20", label: "每页 20 条" }, { value: "50", label: "每页 50 条" }]} />
        <Pagination value={result.page} onChange={(nextPage) => updateParams({ page: nextPage })} total={result.pages} size="sm" withEdges />
      </Flex>
    </Paper>
  </Stack>;
}
