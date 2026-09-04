import { tagVocabularyPrompt } from "./curator-tags.mjs";

const INGEST_BLOCKS = ["tool", "skill", "project", "site", "prompt"];

function normalizedName(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function canonicalResourceUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (url.hostname === "github.com") {
      const [owner, repository] = url.pathname.split("/").filter(Boolean);
      if (owner && repository) url.pathname = `/${owner.toLowerCase()}/${repository.replace(/\.git$/i, "").toLowerCase()}`;
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function similarResources(draft, catalog) {
  const targetUrl = canonicalResourceUrl(draft?.url);
  const targetName = normalizedName(draft?.name);
  return catalog.filter((item) => {
    const sameUrl = targetUrl && canonicalResourceUrl(item.url) === targetUrl;
    const sameName = targetName && normalizedName(item.name) === targetName;
    return sameUrl || sameName;
  }).slice(0, 5);
}

export function buildAgentPrompt({ skill, url, note, catalog, targetBlock, existingContent = "" }) {
  const blockNote = INGEST_BLOCKS.includes(targetBlock)
    ? `目标板块已指定为 ${targetBlock}，不要更改。`
    : "目标板块未指定：由你根据内容判断（tool / skill / project / site / prompt）。";
  return `${skill}

---- 本次任务 ----
整理这条资源：${url}
${blockNote}
整理备注：${String(note || "无").slice(0, 1000)}

分类与标签词表（category 从二级分类中单选；tags 是平级多选标签，没有分组和互斥规则。先在表里找，实在没有合适的才自造一个英文小写连字符 id）：
${tagVocabularyPrompt(targetBlock)}

当前目录（用于查重与避免重复收录；仅参考，不要照抄其中的文案）：
${catalog || "（空）"}${existingContent ? `
这条内容正在被重新处理，现状如下（找出遗漏并改写，不要照抄其中的错误）：
${existingContent.slice(0, 12000)}` : ""}

严格执行调查预算。信息达到最小证据集后立即停止调用工具；不要为了 Logo、star 数、装饰性信息或措辞继续调查。最终只输出一个符合 schema 的 JSON 对象。`;
}

/**
 * The rules below are distilled from the two vendored Skills in
 * `skills/vendor/` rather than injected wholesale. Pasting both files in full
 * (~4.2KB of prose) made the model deliberate for 20K tokens over a 700-word
 * paragraph — 144s. The same task against these six rules costs 6.4K tokens and
 * 50s, and the result reads at least as well. The Skills stay in the repo as
 * the provenance for these rules.
 */
export function buildPolishPrompt({ draft }) {
  return `你是 AI 资源集的中文技术编辑。改写下面的正文，只输出 {"body":"..."}。

规则：
- 保留所有 ## 标题及顺序、链接、命令、代码、配置值和专有名词。
- 只改写 body，不搜索、不调用工具，不增加第一稿没有的事实、数字、功能、平台或许可，不假装作者亲自用过。
- 开头两段让第一次听说它的人看懂：它具体是什么、一次典型操作会发生什么、和常见替代方式有什么实际区别。
- 先讲具体动作和结果，再讲定位。删掉宣传语、资料汇总腔和没有信息量的抽象词。
- 多条命令保留为带语言标识的围栏代码块。
- 500-900 字，不要为凑字数展开。

资源类型：${draft.blockType}
标题：${draft.name}
第一稿：
${String(draft.body || "").slice(0, 24000)}`;
}

/**
 * 翻译轮次跑在润色之后，只看已经定稿的中文正文，所以它不需要资料、也不许上网。
 * 分成独立一轮而不是让主 Agent 一次写两版：调研那一轮已经很长，再要求它输出
 * 双语正文会同时拉低两边的质量。
 */
export function buildTranslatePrompt({ draft }) {
  return `You are the English editor for a curated AI resource library. Translate the Chinese article below and output only {"body":"..."}.

Rules:
- Keep every ## heading, its order, and all links, commands, code, config values and product names exactly as they are.
- Translate only. Do not add facts, numbers, features, platforms or licences that are absent from the Chinese text, and never claim first-hand use.
- Write the plain, concrete English of a technical editor: say what the thing does and what happens when you run it. No marketing voice, no padding.
- Keep multi-command blocks as fenced code blocks with their language tag.
- Match the source's length. Do not summarise it and do not expand it.

Resource type: ${draft.blockType}
Title: ${draft.name}
Chinese article:
${String(draft.body || "").slice(0, 24000)}`;
}
