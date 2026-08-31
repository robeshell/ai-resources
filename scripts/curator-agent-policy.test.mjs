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
