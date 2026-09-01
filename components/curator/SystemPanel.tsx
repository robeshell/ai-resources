"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Accordion, Alert, Autocomplete, Badge, Button, Group, Modal, NumberInput, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { curatorRequest, type AgentInfo, type BuildJob, type PiProjectConfig, type RunRecordStats } from "@/lib/curator-client";
import { useBuildJob } from "@/components/curator/useBuildJob";
import { CuratorPageHeader } from "@/components/curator/CuratorPageHeader";

export function SystemPanel() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [piConfig, setPiConfig] = useState<PiProjectConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [gatewayModels, setGatewayModels] = useState<Array<{ value: string; label: string }>>([]);
  const [contextWindow, setContextWindow] = useState<number | string>(128000);
  const [maxTokens, setMaxTokens] = useState<number | string>(8192);
  const { build, setBuild } = useBuildJob();
  const [records, setRecords] = useState<RunRecordStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [configConfirmOpen, setConfigConfirmOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      curatorRequest<{ tools: AgentInfo[]; build?: BuildJob }>("/health"),
      curatorRequest<PiProjectConfig>("/pi-config"),
      curatorRequest<RunRecordStats>("/runs/records").catch(() => ({ count: 0, bytes: 0, oldest: "" })),
      curatorRequest<BuildJob>("/build").catch(() => ({ status: "idle" as const })),
    ]).then(([health, config, recordData, buildData]) => {
      setAgents(health.tools || []);
      setGatewayModels((health.tools?.[0]?.models || []).map((model) => ({ value: model.id, label: model.label })));
      setPiConfig(config);
      setBaseUrl(config.baseUrl);
      setDefaultModel(config.defaultModel);
      setContextWindow(config.contextWindow);
      setMaxTokens(config.maxTokens);
      setBuild(buildData || health.build || { status: "idle" });
      setRecords(recordData);
    })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "无法读取系统状态"));
  }, [setBuild]);

  async function savePiConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfigBusy(true);
    try {
      const saved = await curatorRequest<PiProjectConfig & { message: string; agents: { tools: AgentInfo[] } }>("/pi-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, defaultModel, contextWindow, maxTokens }),
      });
      setPiConfig(saved);
      setApiKey("");
      setAgents(saved.agents.tools || []);
      setGatewayModels((saved.agents.tools?.[0]?.models || []).map((model) => ({ value: model.id, label: model.label })));
      setError(null);
      notifications.show({ message: saved.message, color: "curator" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pi Agent 配置保存失败");
    } finally {
      setConfigBusy(false);
    }
  }

  async function clearPiConfig() {
    setConfigConfirmOpen(false);
    setConfigBusy(true);
    try {
      const cleared = await curatorRequest<PiProjectConfig & { message: string; agents: { tools: AgentInfo[] } }>("/pi-config", { method: "DELETE" });
      setPiConfig(cleared);
      setBaseUrl("");
      setApiKey("");
      setDefaultModel("");
      setContextWindow(cleared.contextWindow);
      setMaxTokens(cleared.maxTokens);
      setAgents(cleared.agents.tools || []);
      setError(null);
      notifications.show({ message: cleared.message, color: "curator" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "配置清除失败");
    } finally {
      setConfigBusy(false);
    }
  }

  async function testPiConfig() {
    setConfigBusy(true);
    try {
      const result = await curatorRequest<{ message: string }>("/pi-config/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, defaultModel, contextWindow, maxTokens }),
      });
      setError(null);
      notifications.show({ message: result.message, color: "curator" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "连接测试失败");
    } finally {
      setConfigBusy(false);
    }
  }

  async function loadGatewayModels() {
    setConfigBusy(true);
    try {
      const result = await curatorRequest<{ message: string; models: AgentInfo["models"] }>("/pi-config/models", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, defaultModel: defaultModel || "model-list", contextWindow, maxTokens }),
      });
      const options = result.models.map((model) => ({ value: model.id, label: model.label }));
      setGatewayModels(options);
      if (!defaultModel && options[0]) setDefaultModel(options[0].value);
      setError(null);
      notifications.show({ message: result.message, color: "curator" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "模型列表读取失败");
    } finally {
      setConfigBusy(false);
    }
  }

  async function runBuildCheck() {
    setBusy(true);
    try { setBuild(await curatorRequest<BuildJob>("/build", { method: "POST" })); setError(null); notifications.show({ message: "构建校验已开始", color: "curator" }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "构建校验没有开始"); }
    finally { setBusy(false); }
  }
  async function clearRecordsNow() {
    if (!records?.count) return;
    setConfirmOpen(false); setBusy(true);
    try { const next = await curatorRequest<RunRecordStats & { message: string }>("/runs/records", { method: "DELETE" }); setRecords({ count: next.count, bytes: next.bytes, oldest: next.oldest }); setError(null); notifications.show({ message: next.message, color: "curator" }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "清除失败"); }
    finally { setBusy(false); }
  }

  const agent = agents[0];
  return <section className="curator-settings-page">
    <CuratorPageHeader title="项目设置" description="配置仅作用于当前资源库。" />
    {error ? <Alert className="curator-settings-alert" color="red" title="操作失败" role="alert" withCloseButton onClose={() => setError(null)}>{error}</Alert> : null}
    <div className="curator-settings-layout">
      <nav className="curator-settings-nav" aria-label="设置分区">
        <Text size="xs" className="curator-settings-nav-label">设置</Text>
        <a href="#ai-connection"><span>01</span>AI 连接</a>
        <a href="#site-build"><span>02</span>站点构建</a>
        <a href="#local-data"><span>03</span>本地数据</a>
        <Text size="xs" c="dimmed" className="curator-settings-local-note">配置保存在 <code>.curator/</code>，不会读取电脑上的其他 AI 设置。</Text>
      </nav>
      <div className="curator-settings-content">
        <Paper component="form" id="ai-connection" withBorder className="curator-settings-section" onSubmit={savePiConfig}>
          <header className="curator-settings-section-heading"><div><Text className="curator-settings-index">01 / AI</Text><Title order={2}>Pi Agent 连接</Title><Text size="sm" c="dimmed">为这个项目指定独立网关和模型。</Text></div><Badge color={piConfig?.configured ? "curator" : "gray"} variant="light">{piConfig?.configured ? "已配置" : "未配置"}</Badge></header>
          <div className="curator-settings-status-strip">
            <div><Text size="xs" c="dimmed">状态</Text><Text fw={600}>{piConfig?.configured ? "可使用" : "等待配置"}</Text></div>
            <div><Text size="xs" c="dimmed">默认模型</Text><Text fw={600} className="curator-settings-value">{agent?.defaultModelLabel || "—"}</Text></div>
            <div><Text size="xs" c="dimmed">网关模型</Text><Text fw={600} className="curator-number">{gatewayModels.length || "—"}</Text></div>
          </div>
          <Stack gap="lg" className="curator-settings-form">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg"><TextInput required label="网关地址" description="Anthropic Messages 兼容地址" value={baseUrl} onChange={(event) => setBaseUrl(event.currentTarget.value)} placeholder="https://gateway.example.com" autoComplete="off" /><PasswordInput required={!piConfig?.hasApiKey} label="API Key" description={piConfig?.hasApiKey ? `当前保存 ${piConfig.apiKeyHint}` : "只写入当前项目的私有文件"} value={apiKey} onChange={(event) => setApiKey(event.currentTarget.value)} placeholder={piConfig?.hasApiKey ? "留空表示不修改" : "输入项目专用 API Key"} autoComplete="new-password" /></SimpleGrid>
            <div className="curator-settings-model-row"><Autocomplete required label="默认模型" description="可手动输入，也可以从网关拉取" value={defaultModel} onChange={setDefaultModel} data={gatewayModels} placeholder="输入名称或拉取模型" autoComplete="off" /><Button type="button" variant="default" disabled={configBusy || !baseUrl || (!apiKey && !piConfig?.hasApiKey)} onClick={() => void loadGatewayModels()}>拉取模型</Button></div>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg"><NumberInput required min={1} allowDecimal={false} label="上下文窗口" description="模型可接收的最大上下文" value={contextWindow} onChange={setContextWindow} /><NumberInput required min={1} allowDecimal={false} label="最大输出 Token" description="单次回复的输出上限" value={maxTokens} onChange={setMaxTokens} /></SimpleGrid>
          </Stack>
          <footer className="curator-settings-actions"><Group><Button type="submit" loading={configBusy}>保存连接</Button><Button type="button" variant="default" disabled={configBusy || !baseUrl || !defaultModel || (!apiKey && !piConfig?.hasApiKey)} onClick={() => void testPiConfig()}>测试连接</Button></Group>{piConfig?.configured ? <Button type="button" variant="subtle" color="red" disabled={configBusy} onClick={() => setConfigConfirmOpen(true)}>清除配置</Button> : null}</footer>
        </Paper>

        <Paper component="section" id="site-build" withBorder className="curator-settings-section"><header className="curator-settings-section-heading"><div><Text className="curator-settings-index">02 / BUILD</Text><Title order={2}>站点构建</Title><Text size="sm" c="dimmed">发布前验证静态内容和公开页面。</Text></div><Badge color={build.status === "error" ? "red" : build.status === "ok" || build.status === "running" ? "curator" : "gray"} variant="light">{build.status === "running" ? "校验中" : build.status === "ok" ? "已通过" : build.status === "error" ? "失败" : "空闲"}</Badge></header><div className="curator-settings-build-body"><div><Text size="sm" c="dimmed">运行完整的 Next.js 生产构建。失败时日志会保留在下方，不影响当前编辑内容。</Text>{build.error ? <Alert mt="md" color="red" title="校验失败">{build.error}</Alert> : null}<Group mt="lg"><Button loading={busy || build.status === "running"} onClick={runBuildCheck}>运行构建校验</Button><Button component="a" href={build.publicUrl || "http://localhost:3000/zh/"} target="_blank" variant="default">打开公开站</Button></Group></div><Accordion variant="contained"><Accordion.Item value="log"><Accordion.Control>查看构建日志</Accordion.Control><Accordion.Panel><pre className="curator-code-block">{build.log?.trim() || "暂无构建输出"}</pre></Accordion.Panel></Accordion.Item></Accordion></div></Paper>

        <Paper component="section" id="local-data" withBorder className="curator-settings-section"><header className="curator-settings-section-heading"><div><Text className="curator-settings-index">03 / LOCAL</Text><Title order={2}>本地运行记录</Title><Text size="sm" c="dimmed">用于恢复失败任务和查看最近处理过程。</Text></div><Badge color="gray" variant="light">{records ? `${records.count} 份` : "—"}</Badge></header><div className="curator-settings-metrics"><div><Text size="xs" c="dimmed">记录数量</Text><Text fw={600} className="curator-number">{records?.count ?? "—"}</Text></div><div><Text size="xs" c="dimmed">最早记录</Text><Text fw={600} className="curator-number">{records?.oldest ? new Date(records.oldest).toLocaleDateString("zh-CN") : "—"}</Text></div><div><Text size="xs" c="dimmed">磁盘占用</Text><Text fw={600} className="curator-number">{records?.bytes ? `${(records.bytes / 1024).toFixed(1)} KB` : "—"}</Text></div></div><div className="curator-settings-danger"><div><Text fw={600} size="sm">清除运行记录</Text><Text size="xs" c="dimmed">删除失败记录和未保存的分析草稿，不影响已保存资源。</Text></div><Button color="red" variant="light" onClick={() => setConfirmOpen(true)} disabled={busy || !records?.count}>清除记录</Button></div></Paper>
      </div>
    </div>
    <Modal opened={configConfirmOpen} onClose={() => setConfigConfirmOpen(false)} title="清除当前项目的 Pi Agent 配置？" centered><Text size="sm" c="dimmed">之后无法继续对话或整理，重新填写连接信息即可恢复。电脑上的其他 AI 配置不会受到影响。</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfigConfirmOpen(false)}>取消</Button><Button color="red" loading={configBusy} onClick={() => void clearPiConfig()}>清除配置</Button></Group></Modal>
    <Modal opened={confirmOpen} onClose={() => setConfirmOpen(false)} title={`清除 ${records?.count || 0} 份本地运行记录？`} centered><Text size="sm" c="dimmed">未保存的分析草稿会一起消失，此操作无法撤销。</Text><Group justify="flex-end" mt="xl"><Button variant="default" onClick={() => setConfirmOpen(false)}>取消</Button><Button color="red" loading={busy} onClick={() => void clearRecordsNow()}>清除记录</Button></Group></Modal>
  </section>;
}
