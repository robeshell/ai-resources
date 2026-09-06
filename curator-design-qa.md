## 2026-09-06 — 工作台首页重新规划与浅色骨架屏

- 主区改为四个处理队列：待确认、待补齐、草稿、分析失败。每页四条；分析任务可翻页，资源类队列进入带筛选的资源库查看全部。
- 去掉混合相加的待办总数，草稿数量直接使用服务端 total，避免根据有限预览做去重后给出不完整计数。
- 右侧是五类资源的已发布/全部数量及构建状态；下方展示最近修改的四条资源，直接链接编辑器。
- 全后台 Skeleton 使用 #fafbfc 底色与 #edf0f2 浅灰动画层，首页改成与内容行对应的短条。减少动画偏好下停止骨架动画。
- 实测首页及资源库 Skeleton 伪元素颜色为 rgb(250,251,252) / rgb(237,240,242)。
- 实测待确认翻页 1–4、5–8、9–11；切换待补齐/草稿后回到第一页；失败队列可访问第 5 条。CollectUI 最近编辑入口正常打开对应编辑器。
- 1440px、390px 实际截图检查；手机无横向溢出。2560px 下整体左右留白均为 436px。
- DOM 字体审计仍只有 12/14/20px 与 400/500。TypeScript、相关 ESLint、diff check 通过。未启动构建、AI 整理或保存内容。

## 2026-09-06 — 后台文字规范统一

- 字号仅 12 / 14 / 20px，分别用于辅助信息、正文与分区标题、页面标题与关键数字；字重仅 400 / 500。
- Mantine 主题统一字号和字重；原有 curator.css、workspace.css 的字号引用主题变量，清理局部 600/650/700 等字重。
- typography.css 处理门户弹窗、标签、表单说明与错误、Markdown 预览；CodeMirror 保留语法高亮，并把强调字重统一为 500。
- 浏览器 computed-style 审计：工作台、资源库、收录页、设置页、站点/技能/提示词编辑器，以及设置确认弹窗，文字字号和字重均符合规范。
- 临时 Markdown 样例覆盖标题、强调、列表、行内代码及代码块，编辑和预览都通过；已放弃修改，原始资源未保存或改写。
- 390px 手机检查：提示词收录、资源库、编辑器、设置页无横向溢出。确认弹窗仅打开检查后取消。
- 修复验证中发现的 MarkdownEditor 未提供正文时调用 trim 报错，空正文回退为空字符串。
- 验证：相关文件 ESLint、TypeScript noEmit、git diff --check 通过；未运行全量构建。

# Curator workspace redesign — 2026-09-06

Implemented the previously selected admin direction: 176px sidebar, neutral surfaces, compact operational UI, and restrained use of the existing accent. The frontend and resource data are outside this change.

## Scope

- Shared shell: sidebar navigation, editor routes correctly select Resources, mobile drawer, skip link, service status, public-site link and appearance popover.
- Dashboard: all five content types fit a single desktop summary row; actionable content issues expand by default; recent modifications are visible in a separate column.
- Resource library: one status filter, separate issues toggle, type tabs, search and sort. Removed duplicate status overview and normal-state result banner. Rows use title/summary and quiet status labels; slug/source remain in the link tooltip. Selection actions appear only after selection. Existing pagination and bulk operations remain wired.
- Editor: equal-height conversation and form panes on desktop; metadata, taxonomy and entry URLs are expandable, exposing content first. Validation opens the properties when needed. Discard restores content and clears validation feedback. Save remains explicit. Corrected the historical suggestion copy so it no longer says to save when content already matches.
- Ingest/settings: shared type scale and compact controls; improved mobile model selector and neutral prompt capture note. Preserved prompt-specific capture, model selection, confirmation and settings functions.

## Validation

- TypeScript no-emit and focused ESLint passed. Diff whitespace passed. No full build or unrelated tests.
- Desktop: 1440 × 900; resource library also checked at 1280 × 720. First row starts at approximately 247px and rows measure about 61px at the checked library state, compared with the earlier audit's roughly 480px first row.
- Checked live site filter (5 rows), CollectUI search (1 row), row selection and cancel, and editor navigation.
- Changed a summary locally and discarded it; state changed from 修改中 to 已保存. No resource was saved.
- Entered an invalid blank title and tried save: validation prevented persistence, reopened properties, and marked the field. Discard restored CollectUI and cleared validation. Desktop editor panes both measured 836px tall at 1440 × 900.
- Mobile: dashboard, resources, ingest, editor and settings at 390 × 844 all had document width 390px. Drawer navigation closes after selection. Prompt type switches to body/source capture. The mobile model selector was widened from about 94px to 192px.
- Appearance popover opens and Escape closes it. Browser warning/error check returned no entries.
- AI generation, actual resource persistence, publishing, bulk status mutations, configuration writes and build execution were not triggered by visual QA. Existing service errors and incomplete content were not modified.

## Screenshots

Directory: `/Users/wangwenyu/.codex/visualizations/2026/09/06/01a0740d-28d8-7da2-9998-4454ee237a4f/ai-resources-audit`

- `35-admin-dashboard.png`
- `36-admin-library.png`
- `37-admin-editor.png`
- `38-admin-library-mobile.png`
- `39-admin-ingest-mobile.png`
- `40-admin-dashboard-mobile.png`

Result: visual, navigation, selection and local form-state checks passed. Existing backend operations remain connected but were not re-executed as part of this UI task.
