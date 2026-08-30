# AI Resources

一份围绕真实任务整理的 AI 资源索引。中英两版，收录值得使用的 AI 产品、Skills 与开源项目。

公开站保持瑞士极简：纸感底色、IBM Plex、无装饰图标、无营销腔。之上有一层外观系统：明暗双主题 + 5 种主题色（`lib/theme.ts`），刷新不闪（`app/layout.tsx` 注入的内联脚本先于渲染恢复上次选择）。动效走 transitions.dev 的语义 token（`app/transitions/`）加 React `<ViewTransition>` 页面转场，集中封装在 `components/Transitions.tsx`。

Curator 管理台使用 [Mantine](https://mantine.dev/) 构建（`app/curator/curator.css` 做主题定制），与公开站视觉体系互不依赖。

## 本地运行

```bash
npm install
npm run dev    # http://localhost:3000 → /en/
```

| 路径 | 说明 |
|------|------|
| `/en/` `/zh/` | 工具、技能、项目、提示词板块首页 |
| `/en/skills/[slug]/` | 技能正文 |
| `/en/projects/[slug]/` | 项目正文 |
| `/en/prompts/[slug]/` | 提示词正文 |
| `/curator/` | 本地管理台（工作台、资源库、收录、系统） |

## 本地 Curator

Curator 负责读取链接，调用本机 **Codex** 或 **Claude Code** 生成分类与双语草稿，并在人工确认后写入本地 SQLite。公开站仍只读取导出的静态 JSON/Markdown；服务只监听 `127.0.0.1`，不会随静态站部署。

```bash
npm run curator
```

打开 `http://localhost:3000/curator/`：

| 路径 | 说明 |
|------|------|
| `/curator/` | 工作台：待办、内容检查、最近修改、构建状态 |
| `/curator/resources/` | 统一资源库：板块、检索、筛选、排序、分页和批量操作 |
| `/curator/resources/[block]/[slug]` | 对应板块的独立编辑器 |
| `/curator/ingest/` | 收录一条（Codex / Claude Code） |
| `/curator/settings/` | 系统：Agent、构建校验和运行记录 |

「构建校验」只在系统页执行；工作台只显示构建状态和失败入口。编辑页不做重复预览，保存后直接打开公开站查看。运行手册见 `docs/curator.md`，系统架构见 `docs/architecture.md`。

如果暂时不想调用 Agent，在 `.env.local` 设置 `CURATOR_DISABLE_AI=1`，工具会退回元信息与关键词规则。

## 怎么管理数据

Curator 的唯一编辑源是本机 `.curator/content.sqlite`，公开站只消费派生文件。

| 文件 | 职责 |
|------|------|
| `data/tools.json` | 工具板块的静态导出（产品名、链接、定价、verdict、summary） |
| `content/skills/*.md` | 技能板块的 Markdown 静态导出 |
| `content/projects/*.md` | 项目板块的 Markdown 静态导出 |
| `content/prompts/*.md` | 提示词板块的 Markdown 静态导出 |
| `.curator/content.sqlite` | Curator 本地编辑源、版本和 Agent 记录（不提交） |
| `data/site.json` | 公开站更新时间 |

### 一条工具最少要有什么

- `name` / `url`：官方名和官网，专有名词不翻译
- `pricing`：`free` \| `freemium` \| `paid` \| `api`
- `verdict.en` + `verdict.zh`：**为什么在这份清单上**，没有双语 verdict 会直接让构建失败
- `summary.en` + `summary.zh`：快速查看里的补充说明
- `status: archived` 等于下架，页面不再生成

### 日常怎么改

1. 新增或修改：打开 Curator 对应板块编辑器；工具编辑卡片字段，技能/项目/提示词编辑正文。
2. 收录：从 `/curator/ingest/` 自动判断或指定目标板块，让 AI/Agent 生成草稿，保存后进入对应编辑器。
3. 淘汰：在对应编辑器里归档；AI 重新处理先在抽屉里预览改写结果，采用后仍需在编辑器保存，不会直接覆盖。
4. 保存发布内容会立即导出；发布前在系统页运行构建校验。

Logo 统一存本地 `public/logos/`；Curator 收录时会自动抓取并固化单条 Logo。

界面翻译（导航、按钮、定价标签）在 `lib/i18n.ts`，和工具数据分开，避免改一句按钮去翻 `tools.json`。

SQLite 导入和静态导出命令：

```bash
npm run curator:migrate:check # 在临时副本上检查迁移
npm run curator:migrate       # 备份后迁移 .curator/content.sqlite
npm run curator:export:check # 查看静态导出计划
npm run curator:export       # 写入 data/tools.json 和 content/*
```

## 技术栈

Next.js 16（`output: "export"`）+ React 19 + TypeScript。静态导出，可部署 GitHub Pages。

- 公开站：无框架定制 CSS（`app/globals.css` + `app/transitions/`），无 UI 依赖。
- Curator：Mantine 9（`@mantine/core` / `hooks` / `notifications`），主题定制在 `app/curator/curator.css`。
- 内容模型与状态机见 `docs/data-model.md`。

## 部署

仓库包含 `.github/workflows/deploy-pages.yml`。首次部署时，在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**。之后推送到 `main` 会自动：

1. 安装依赖并执行 Lint。
2. 运行 `curator:export` 从数据库生成静态产物。
3. 根据 Pages 地址设置 Next.js `basePath` 并构建。
4. 将 `out/` 静态文件发布到 GitHub Pages。

发布工作流会在上传前移除 `out/curator/`。线上只包含公开导航站的 HTML、CSS、JavaScript 和本地 Logo，不包含 Curator 页面、服务、Codex 会话或任何密钥。
