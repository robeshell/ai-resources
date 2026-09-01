# Curator 运行手册

本地内容管理台的启动、AI 配置、日常流程与安全边界。架构背景见 `docs/architecture.md`，内容契约见 `docs/data-model.md`。

## 启动

```bash
npm run curator           # 同时启动 curator-server(:4317) 和公开站 dev(:3000)
npm run curator:server    # 只启动服务
```

顶栏连接指示显示「服务正常 / 服务未启动」；未启动时页面仍可浏览，写操作会失败。首次冷启动会从 `data/tools.json` 引导生成 `.curator/content.sqlite`（已存在则直接用，绝不重复导入）。

## Agent 配置

收录和「AI 重新处理」统一使用内置 Pi Agent，整理规则在 `skills/curator-ingest/SKILL.md`。网关地址、API Key 和默认模型在 Curator「系统」页配置，只保存在项目忽略提交的 `.curator/pi-config.json` 中，不读取或修改电脑上的 Claude、Codex 与 CC Switch 配置。

- 界面只切换模型，不再启动 Codex 或 Claude Code CLI。
- Agent 仅拥有 `web_fetch`、`web_search`、`submit_draft` 三个工具；网页工具最多调用 4 次，草稿只能进入人工确认。

## 收录流程（`/curator/ingest/`）

1. 粘贴链接，可选指定目标板块（默认让 Agent 判断）。
2. Agent 按 `skills/curator-ingest/SKILL.md` 自行访问页面、对照目录、撰写草稿，进度实时显示。
3. 草稿就绪后人工核对：板块、双语文案（实时字数：verdict ≤16 字/8 词，summary ≤32 字/22 词）、定价、平台。
5. 保存：工具直接发布上线；技能/项目/提示词存为草稿，补正文后发布。
6. 「重新生成草稿」复用已抓取的页面只重跑 Agent，「重新分析」完全重来；分析面板可切换网关模型后重试。

来源无法抓取（如站点拒绝自动抓取）时，**重新处理**会降级用当前内容作依据继续走完流程；全新收录没有依据，会明确报错。

## 编辑与候选（`/curator/resources/`）

- 列表负责查找：板块、检索、状态、排序、分页、「只看有问题的」（服务端统计缺失字段数）。
- 每条内容在独立编辑器里编辑，带未保存离开提醒和 revision 乐观锁（他人先保存会收到冲突提示）。
- 「AI 重新处理」抽屉：填处理要求 → 一行进度 → 预览改了哪些字段 → 「采用新版本」回到编辑器，保存后生效；放弃则不留任何痕迹。Agent 没产出结果时显示原因，可重试。
- 批量发布/归档在列表多选后操作。

## 系统页（`/curator/settings/`）

- **构建校验**：跑一次 `next build` 验证导出产物能否构建，实时日志；工作台只显示状态和失败入口。
- **Pi Agent 连接**：配置当前项目专用的网关地址、API Key、默认模型与 Token 上限；可从网关拉取模型，并用所选模型发起最小请求测试连接。API Key 只显示尾号，可单独清除。
- **Agent**：显示项目连接是否可用及网关返回的模型列表。
- **运行记录**：本地 JSONL 任务记录统计（保留 30 份、14 天），可一键清除。

## 安全边界

- 服务只监听 `127.0.0.1`；CORS 白名单 = 本站来源 + `CURATOR_ALLOWED_ORIGIN`。
- Pi Agent 密钥只写入忽略提交的 `.curator/pi-config.json`，权限为 `0600`；配置接口不返回明文密钥。
- 抓取前做 SSRF 校验：仅 http(s)、拒绝本机/内网/保留地址、每个重定向都重新校验；页面体积上限 2MB。
- Agent 工具结果不写入公开数据；草稿经过 schema 和字段规则校验后才可人工采用。
- 保存请求体上限 128KB；草稿字段逐项清洗与截断（`normalizeDraft`）。
- `.curator/` 与 `.env*` 都在 `.gitignore`；发布产物中不含 Curator 任何部分。

## 常见问题

| 现象 | 处理 |
|------|------|
| 页面提示「服务未启动」 | 先 `npm run curator`（或 `curator:server`） |
| 「站点拒绝自动抓取」 | 站点屏蔽了服务端抓取（如 openai.com）；收录换来源，重新处理会自动降级用现有内容 |
| 「这条资源已经存在」 | slug 或官网链接与目录重复，换 slug 或确认不是重复收录 |
| 「内容已在其他窗口更新」 | 另一个窗口先保存了，刷新编辑器后重做修改 |
| 保存后公开站没变化 | 工具需刷新；长文确认已发布（`active`）且有正文 |
