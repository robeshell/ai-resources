"use client";

import { useEffect, useState } from "react";
import { Accordion, Alert, Badge, Box, Button, Group, Modal, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { curatorRequest, type AgentInfo, type BuildJob, type RunRecordStats } from "@/lib/curator-client";
import { useBuildJob } from "@/components/curator/useBuildJob";

export function SystemPanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const { build, setBuild } = useBuildJob();
  const [records, setRecords] = useState<RunRecordStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      curatorRequest<{ tools: AgentInfo[]; build?: BuildJob }>("/health"),
      curatorRequest<RunRecordStats>("/runs/records").catch(() => ({ count: 0, bytes: 0, oldest: "" })),
      curatorRequest<BuildJob>("/build").catch(() => ({ status: "idle" as const })),
    ]).then(([health, recordData, buildData]) => { setAgents(health.tools || []); setBuild(buildData || health.build || { status: "idle" }); setRecords(recordData); })
      .catch((caught) => setMessage(caught instanceof Error ? caught.message : "无法读取系统状态"));
  }, [setBuild]);

  async function runBuildCheck() {
    setBusy(true);
    try { setBuild(await curatorRequest<BuildJob>("/build", { method: "POST" })); setMessage("构建校验已开始"); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "构建校验没有开始"); }
    finally { setBusy(false); }
  }
  async function clearRecordsNow() {
    if (!records?.count) return;
    setConfirmOpen(false); setBusy(true);
    try { const next = await curatorRequest<RunRecordStats & { message: string }>("/runs/records", { method: "DELETE" }); setRecords({ count: next.count, bytes: next.bytes, oldest: next.oldest }); setMessage(next.message); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "清除失败"); }
    finally { setBusy(false); }
  }

  return <Stack gap="xl">
    <Box className="curator-page-heading-mantine"><Text className="curator-eyebrow-mantine">系统</Text><Title order={1} mt={4}>运行与连接</Title><Text c="dimmed" mt="xs">检查本机 Agent、公开站构建和本地运行记录。</Text></Box>
    {message ? <Alert color="curator" title="系统状态" role="status">{message}</Alert> : null}
    <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
      <Paper withBorder p="xl"><Group justify="space-between" mb="lg"><Box><Text className="curator-eyebrow-mantine">本机</Text><Title order={2} mt={4}>Agent</Title></Box><Badge color={agents.some((agent) => agent.available) ? "curator" : "red"} variant="light">{agents.filter((agent) => agent.available).length} 可用</Badge></Group>
        {!agents.length ? <Stack gap="xs"><Skeleton h={48} /><Skeleton h={48} /></Stack> : <Stack gap={0}>{agents.map((agent) => <Group key={agent.id} justify="space-between" py="sm" className="curator-system-row"><Box><Text fw={600} size="sm">{agent.label}</Text><Text size="xs" c="dimmed" mt={2}>{agent.available ? agent.defaultModel || "默认模型" : "不可用"}</Text></Box><Badge color={agent.available ? "curator" : "red"} variant="dot">{agent.available ? "正常" : "离线"}</Badge></Group>)}</Stack>}
      </Paper>

      <Paper withBorder p="xl"><Group justify="space-between" mb="lg"><Box><Text className="curator-eyebrow-mantine">公开站</Text><Title order={2} mt={4}>构建校验</Title></Box><Badge color={build.status === "error" ? "red" : build.status === "ok" || build.status === "running" ? "curator" : "gray"} variant="light">{build.status === "running" ? "校验中" : build.status === "ok" ? "已通过" : build.status === "error" ? "失败" : "空闲"}</Badge></Group>
        <Stack gap="md">{build.error ? <Alert color="red" title="校验失败">{build.error}</Alert> : <Text size="sm" c="dimmed">运行 Next.js 生产构建，确认公开站可以正常发布。</Text>}<Group><Button loading={busy || build.status === "running"} onClick={runBuildCheck}>构建校验</Button><Button component="a" href={build.publicUrl || "http://localhost:3000/zh/"} target="_blank" variant="default">打开公开站</Button></Group><Accordion variant="contained"><Accordion.Item value="log"><Accordion.Control>构建日志</Accordion.Control><Accordion.Panel><pre className="curator-code-block">{build.log?.trim() || "暂无构建输出"}</pre></Accordion.Panel></Accordion.Item></Accordion></Stack>
      </Paper>

      <Paper withBorder p="xl"><Group justify="space-between" mb="lg"><Box><Text className="curator-eyebrow-mantine">本地记录</Text><Title order={2} mt={4}>Agent 运行记录</Title></Box><Badge color="gray" variant="light">{records ? `${records.count} 份` : "—"}</Badge></Group>
        <SimpleGrid cols={2} spacing="sm" mb="lg"><Box><Text size="xs" c="dimmed">最早一份</Text><Text fw={600} mt={4} className="curator-number">{records?.oldest ? new Date(records.oldest).toLocaleDateString("zh-CN") : "—"}</Text></Box><Box><Text size="xs" c="dimmed">占用</Text><Text fw={600} mt={4} className="curator-number">{records?.bytes ? `${(records.bytes / 1024).toFixed(1)} KB` : "—"}</Text></Box></SimpleGrid>
        <Button color="red" variant="light" onClick={() => setConfirmOpen(true)} disabled={busy || !records?.count}>清除运行记录</Button>
      </Paper>
    </SimpleGrid>
    <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title={`清除 ${records?.count || 0} 份本地运行记录？`} centered><Text size="sm" c="dimmed">未保存的分析草稿会一起消失，此操作无法撤销。</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfirmOpen(false)}>取消</Button><Button color="red" loading={busy} onClick={() => void clearRecordsNow()}>清除记录</Button></Group></Modal>
  </Stack>;
}
