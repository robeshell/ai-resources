# AI Resources

一份围绕真实任务整理的 AI 资源索引。中英两版，收录值得使用的 AI 产品、Skills 与开源项目。

界面与 [LLM 模型对比](https://github.com/robeshell/llm-model-comparison) 同一套瑞士极简：白底、`#171717`、IBM Plex、无装饰图标、无营销腔。

## 本地运行

```bash
npm install
npm run dev    # http://localhost:3000 → /en/
```

| 路径 | 说明 |
|------|------|
| `/en/` `/zh/` | 产品、Skills、开源项目分类首页 |
| `/en/c/chat/` | 分类 |
| `/en/t/claude/` | 工具详情 |
| `/curator/` | 本地管理台（总览、资源库、收录、清单、设置） |

## 本地 Curator

Curator 负责读取链接，调用本机 **Codex** 或 **Claude Code** 生成分类与双语文案草稿，并在人工确认后写入 JSON。服务只监听 `127.0.0.1`，不会随静态站部署。

```bash
npm run curator
```

打开 `http://localhost:3000/curator/`：

| 路径 | 说明 |
|------|------|
| `/curator/` | 总览 |
| `/curator/resources/` | 资源库：筛选、编辑、归档 |
| `/curator/ingest/` | 收录一条（Codex / Claude Code） |
| `/curator/inbox/` | 模型待转移清单 |
| `/curator/scenarios/` | 场景方案 |
| `/curator/settings/` | 评测站地址 |

顶栏「生成预览」会跑本地构建。完整约定见 `docs/curator-plan.md`。

如果暂时不想调用 Agent，在 `.env.local` 设置 `CURATOR_DISABLE_AI=1`，工具会退回元信息与关键词规则。

## 分类

一级分类固定 6 个，表示用户要完成的工作。资源类型（产品、Skill、开源项目、模型）作为第二层筛选，不与场景分类混用。

| slug | EN | 中文 | 收什么 |
|------|----|------|--------|
| `chat` | Work | 写作办公 | 通用助手与日常工作 |
| `code` | Build | 编程开发 | 编辑器、编程 Agent 与开发资源 |
| `image` | Design | 图像设计 | 图像、平面与视觉系统 |
| `video` | Media | 视频音频 | 视频、语音与媒体生产 |
| `research` | Research | 搜索研究 | 带来源的搜索与阅读 |
| `agents` | Automate | 自动化 | Agent、集成与工作流 |

## 怎么管理数据

全部是仓库里的 JSON。改文件、提交、构建，没有后台、没有数据库。

| 文件 | 职责 |
|------|------|
| `data/categories.json` | 6 个使用场景的中英名称和一句话 |
| `data/tools.json` | AI 产品（产品名、链接、定价、verdict、summary） |
| `data/resources.json` | Skills 与开源项目 |
| `data/scenarios.json` | 场景方案及推荐组合（V1 首页未使用） |
| `data/model-inbox.json` | Curator 收下的模型，留给模型对比站 |
| `data/site.json` | `updatedAt`、评测站 URL |

### 一条工具最少要有什么

- `name` / `url`：官方名和官网，专有名词不翻译
- `category`：上面 6 个 slug 之一
- `pricing`：`free` \| `freemium` \| `paid` \| `api`
- `verdict.en` + `verdict.zh`：**为什么在这份清单上**，没有双语 verdict 会直接让构建失败
- `summary.en` + `summary.zh`：详情页多两句
- `status: archived` 等于下架，页面不再生成
- `featured` 目前不控制首页；首页按场景展示全部 `status: active` 的条目

### 日常怎么改

1. 新增：在 `tools.json` 或 `resources.json` 末尾加一条，中英 verdict 成对写。重新构建后会出现在对应场景。
2. 淘汰：`status` 改成 `archived`，或直接删。满 80 条就先淘汰再加。
3. 改文案：只动对应语言字段，不要把产品名翻成中文。
4. 改评测站地址：只改 `data/site.json` 的 `rankingUrl`。
5. 改完把 `site.json` 的 `updatedAt` 改成当天。

界面翻译（导航、按钮、定价标签）在 `lib/i18n.ts`，和工具数据分开，避免改一句按钮去翻 `tools.json`。

## 技术栈

Next.js（`output: "export"`）+ TypeScript + Tailwind CSS 4。静态导出，可部署 GitHub Pages。

## 部署

仓库包含 `.github/workflows/deploy-pages.yml`。首次部署时，在 GitHub 仓库的 **Settings → Pages → Build and deployment** 中把 Source 设为 **GitHub Actions**。之后推送到 `main` 会自动：

1. 安装依赖并执行 Lint。
2. 根据 Pages 地址设置 Next.js `basePath`。
3. 将 `out/` 静态文件发布到 GitHub Pages。

发布工作流会在上传前移除 `out/curator/`。线上只包含公开导航站的 HTML、CSS、JavaScript 和本地 Logo，不包含 Curator 页面、服务、Codex 会话或任何密钥。
