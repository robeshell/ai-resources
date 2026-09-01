import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildAgentPrompt, buildPolishPrompt, canonicalResourceUrl, similarResources } from "./curator-agent-policy.mjs";

test("GitHub duplicate detection compares repository identity, not the shared host", () => {
  const catalog = [
    { name: "OpenAI Skills", url: "https://github.com/openai/skills" },
    { name: "Transitions.dev", url: "https://github.com/Jakubantalik/transitions.dev/" },
  ];
  assert.deepEqual(similarResources({ name: "Another project", url: "https://github.com/acme/another" }, catalog), []);
  assert.deepEqual(similarResources({ name: "Transitions", url: "https://github.com/jakubantalik/transitions.dev/tree/main" }, catalog), [catalog[1]]);
  assert.equal(canonicalResourceUrl("https://github.com/Jakubantalik/transitions.dev.git/"), "https://github.com/jakubantalik/transitions.dev");
});

test("the ingest policy gives the Agent a finite research budget and a stop condition", () => {
  const skill = readFileSync(new URL("../skills/curator-ingest/SKILL.md", import.meta.url), "utf8");
  const prompt = buildAgentPrompt({ skill, url: "https://example.com", note: "", catalog: "", targetBlock: "auto" });
  assert.match(prompt, /最多 4 个/);
  assert.match(prompt, /最小证据集/);
  assert.match(prompt, /立即停止调用工具/);
  assert.match(prompt, /不要为了 Logo/);
});

test("each long-form category has a stable Markdown template without encouraging extra research", () => {
  const skill = readFileSync(new URL("../skills/curator-ingest/SKILL.md", import.meta.url), "utf8");
  for (const heading of [
    "## 它解决什么问题", "## 输入与结果",
    "## 它是什么", "## 怎么运行", "## 核心机制",
    "## 适合谁", "## 使用边界",
  ]) assert.match(skill, new RegExp(heading));
  assert.match(skill, /500–900 个中文字符/);
  assert.match(skill, /不为了凑长度继续调用工具/);
  assert.match(skill, /body` 必须为空字符串/);
  assert.match(skill, /中文通常 120–240 字/);
  assert.match(skill, /详情弹层使用 `description`/);
});

test("long-form drafts require readable technical Markdown", () => {
  const policy = readFileSync(new URL("../skills/curator-ingest/SKILL.md", import.meta.url), "utf8");
  assert.match(policy, /带语言标识的围栏代码块/);
  assert.match(policy, /机制列表使用 `- \*\*短标签\*\*：解释`/);
  assert.match(policy, /没有可靠数据就不造表格/);
});

test("the polish pass is body-only and cannot invent research", () => {
  const prompt = buildPolishPrompt({
    draft: { blockType: "project", name: "Demo", summary: { zh: "摘要" }, body: "## 它是什么\n\n第一稿" },
  });
  assert.match(prompt, /只改写 body/);
  assert.match(prompt, /不搜索、不调用工具/);
  assert.match(prompt, /不增加第一稿没有的事实/);
  assert.match(prompt, /保留所有 ## 标题及顺序/);
  assert.match(prompt, /它具体是什么、一次典型操作会发生什么/);
  // The rules are distilled, not injected: pasting both Skills in full made the
  // model deliberate for 20K tokens over one paragraph.
  assert.ok(prompt.length < 1600, `润色 prompt 应保持精简，当前 ${prompt.length} 字符`);
});

test("the Agent gets the real tag vocabulary, ids and judgement hints included", () => {
  const prompt = buildAgentPrompt({
    skill: "SKILL", url: "https://example.dev", note: "", catalog: "", targetBlock: "tool",
  });
  const vocabulary = JSON.parse(readFileSync(new URL("../data/taxonomy.json", import.meta.url), "utf8"));
  // A paraphrase drifts from the file; the prompt has to carry every id and
  // hint, or the Agent invents synonyms for tags that already exist.
  for (const entry of [...vocabulary.categories, ...vocabulary.tags]) {
    assert.ok(prompt.includes(entry.id), `词表缺少条目 ${entry.id}`);
    assert.ok(prompt.includes(entry.hint), `词表缺少 ${entry.id} 的判定说明`);
  }
  assert.match(prompt, /先在表里找/);
  assert.match(prompt, /二级分类（写入 category）/);
  assert.match(prompt, /标签（写入 tags）— 所有标签平级、独立多选，没有互斥规则。/);
});

test("the ingest rules keep the Agent out of this site's own published copy", () => {
  const skill = readFileSync(new URL("../skills/curator-ingest/SKILL.md", import.meta.url), "utf8");
  // The deployed site outranks some product pages for its own entries, and an
  // Agent that finds it will lift the very copy this rebuild is replacing —
  // observed verbatim on three of the first three runs.
  assert.match(skill, /robeshell\.github\.io\/ai-resources/);
  assert.match(skill, /一个字都不要引用/);
  // Verdicts must differentiate, not define a category, and the check has to be
  // a test the model applies — naming exemplars just gets them pastiched back.
  assert.match(skill, /把这句话原样套到同类的另外两个产品上/);
  // The tone examples must not name a product that could be ingested — the old
  // set listed seven, all seven were on the ingest list, and the Agent copied
  // their verdicts back verbatim instead of writing its own. Scope the check to
  // the examples block: naming Codex in a definition elsewhere is fine, handing
  // the Agent a finished verdict for it is not.
  const examples = skill.slice(skill.indexOf("口吻示例"), skill.indexOf("## 各板块产出"));
  for (const answered of ["Claude", "ChatGPT", "Gemini", "Cursor", "NotebookLM", "Perplexity", "Codex", "Taste"]) {
    assert.ok(!examples.includes(answered), `口吻示例不能给出 ${answered} 的现成答案`);
  }
  assert.match(skill, /二级分类看这个产品\*\*主要是干什么的\*\*/);
});
