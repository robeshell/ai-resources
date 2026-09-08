# 首批工具收录与核验记录

核验日期：2026-09-08。首批共 8 个，覆盖 6 类任务。依据是本次读取的官方产品页与文档，不是登录后实测、效果排名或对所有竞品的比较。金额、模型版本和固定调用次数不写入长期文案。

平台标签只记录本轮有官方依据的入口，不宣称枚举全部集成。API 标签仅在本次作为使用入口明确核实时填写；同一厂商的开发者平台没有单独收录。

## ChatGPT

- 标识：`chatgpt`；分类：`chat`。
- 入选理由：覆盖从文件分析到文档交付的通用任务；与 Claude 的 Artifacts 迭代入口形成不同侧重。
- 定位：把零散材料整理成可交付文件。
- 使用入口：[ChatGPT](https://chatgpt.com/)。

- [使用方式与文件交付](https://learn.chatgpt.com/docs/use-chatgpt)：核实 Chat、Work 的用途以及网页、桌面入口；不把不同模式的全部能力写成免费功能。
- [套餐与用量](https://learn.chatgpt.com/docs/pricing)：核实免费及付费方案、Work 与 Codex 共用用量；未写易变价格和模型版本。

## Claude

- 标识：`claude`；分类：`chat`。
- 入选理由：保留围绕同一份内容持续讨论和修改的工作方式，不以笼统的写作能力强弱作比较。
- 定位：在对话旁反复修改文档与原型。
- 使用入口：[Claude](https://claude.ai/)。

- [Artifacts 使用说明](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)：核实独立内容窗口、可修改内容、免费方案与能力开关要求。
- [套餐与平台](https://claude.com/pricing)：核实网页、桌面、移动端与用量限制。

## Cursor

- 标识：`cursor`；分类：`coding`。
- 入选理由：覆盖以编辑器为工作中心的协作方式；与 Claude Code 的终端及脚本工作流区分。
- 定位：在编辑器里让助手接手改代码。
- 使用入口：[Cursor](https://cursor.com/)。

- [Agent 与检查点](https://cursor.com/docs/agent/overview)：核实侧栏、文件操作、终端、检查点及网页 Agent 入口。
- [套餐](https://cursor.com/pricing)：核实免费 Agent 限额与付费提高用量。
- [命令行](https://cursor.com/docs/cli/overview)：核实 CLI 入口；不把终端能力写成 Claude Code 独有。

## Claude Code

- 标识：`claude-code`；分类：`coding`。
- 入选理由：覆盖项目目录、命令行及脚本驱动的工程任务，不宣传自动完成就等于验证通过。
- 定位：在终端里执行跨文件工程任务。
- 使用入口：[Claude Code](https://code.claude.com/docs/en/overview)。

- [工作方式与接入](https://code.claude.com/docs/en/overview)：核实跨文件操作、验证命令、CLI 管道以及多种界面和账户要求。
- [Claude 套餐](https://claude.com/pricing)：核实 Free 不包含 Claude Code，Pro 包含；不将 API 计费混为免费。

## Recraft Studio

- 标识：`recraft-studio`；分类：`image`。
- 入选理由：为图像名额选择可编辑素材这一具体任务，与通用助手内生图形成差异。
- 定位：生成能继续编辑的矢量素材。
- 使用入口：[Recraft Studio](https://www.recraft.ai/)。

- [图像与矢量能力](https://www.recraft.ai/)：核实可编辑矢量图、风格与直接 Studio 入口。
- [Studio 工作方式](https://www.recraft.ai/docs/recraft-studio/overview)：核实图像编辑、风格、配色与样机。
- [移动端](https://www.recraft.ai/docs/mobile-apps)：核实移动客户端。
- [生成内容权限](https://www.recraft.ai/docs/trust-and-security/ownership)：核实免费公开且不可商用、付费内容权限，以及升级不追溯旧图片。

## Runway

- 标识：`runway`；分类：`video`。
- 入选理由：覆盖镜头生成与已有片段修改的连续任务；按 video 收录，不因图像功能改变主分类。
- 定位：生成镜头并修改已有视频。
- 使用入口：[Runway](https://runway.com/product)。

- [产品与平台入口](https://runway.com/product)：核实视频生成、素材修改、网页与 Android/iOS 入口。
- [免费方案边界](https://help.runwayml.com/hc/en-us/articles/50404627334547-Free-plan-details)：核实一次性额度、不续补、水印和模型权限差异。

## Gemini Notebook

- 标识：`gemini-notebook`；分类：`research`。
- 入选理由：覆盖围绕特定资料集阅读与回查出处的需求，而非再收一个泛搜索问答入口。
- 定位：围绕资料提问并回看引用出处。
- 使用入口：[Gemini Notebook](https://notebook.google.com/)。

- [现行产品入口](https://notebook.google/)：原 https://notebooklm.google/ 重定向至此，页面标题为 Gemini Notebook；据此采用现行名称。
- [功能与地区条件](https://support.google.com/gemininotebook/answer/16164461?hl=en)：核实来源类型、引用、概览、账号条件与移动端存在；未断言中国大陆可直接使用。
- [用量规则](https://support.google.com/gemininotebook/answer/17670842?hl=en)：核实 2026-09-02 起按计算用量、任务复杂度等限制；不沿用旧的每日聊天次数表。

## ElevenLabs

- 标识：`elevenlabs`；分类：`audio`。
- 入选理由：把音频名额聚焦到给已有文稿配音，比同时涵盖作曲、转写和语音模型更易选择。
- 定位：把文稿转成可调语气的配音。
- 使用入口：[ElevenLabs](https://elevenlabs.io/text-to-speech)。

- [文字配音工作方式](https://elevenlabs.io/text-to-speech)：核实文本输入、选声音、语气节奏、导出、网页和 API。
- [发布与商用条件](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)：核实免费非商用与署名、付费商用及 Beta 服务例外；未填写易变价格和额度。

## 范围与维护

- 其他通用助手和编码 Agent 暂不追加；先保持当前两种工作侧重，不以品牌数量衡量完整性。
- 图像名额聚焦可编辑素材；音频名额聚焦配音，音乐生成暂不收录。
- 自动化平台、纯 API 服务、厂商及模型本体不进入首批。
- 不将文档核验写成实测推荐；账号实际可用性、具体生成质量、速度和区域网络体验尚未实测。
- 未来新增前先说明对已有条目的任务增量，优先替换同质条目。

## 入库与展示检查

- 内容库和公开导出均为 8 条 active 工具，6 个分类，编辑完整性检查为 0 个问题。
- 所有条目的中英文定位、摘要、两段详情、来源链接及本地图标文件已校验。
- 通过现有内容仓库批量保存，使用现有导出器导出到临时目录后仅同步 tools.json。
- 其余 24 条内容库记录及其他板块的 Markdown、分类词表和站点信息均与操作前一致。
- 本地浏览器已确认中英文目录均显示 8 个工具；抽查中文 Recraft Studio、英文 Gemini Notebook 详情及入口，中文详情分段和图标正常。
- 收录后补充修正目录响应式布局：宽屏保持四列均匀分布，中窄屏整体居中且同列上下对齐；已检查 1440px、846px 及 390px。
- 本轮仅涉及内容、图标与目录 CSS，未运行全量测试或构建；线上部署状态需另行确认。
