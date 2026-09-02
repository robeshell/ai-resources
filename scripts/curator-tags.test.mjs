import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, categoriesForBlock, categoryOf, knownCategory, tagVocabularyPrompt } from "./curator-tags.mjs";

const BLOCKS = ["tool", "skill", "project", "site", "prompt"];

test("each enabled content type has its own non-empty category vocabulary", () => {
  const signatures = new Set();
  for (const block of BLOCKS) {
    const ids = categoriesForBlock(block).map((category) => category.id);
    assert.ok(ids.length > 0, `${block} 缺少分类`);
    signatures.add(ids.join(","));
  }
  assert.equal(signatures.size, BLOCKS.length, "一级内容类型不应复用完全相同的二级分类列表");
});

test("category validation is scoped to the content type", () => {
  assert.ok(knownCategory("chat", "tool"));
  assert.equal(knownCategory("chat", "skill"), undefined);
  assert.equal(categoryOf({ category: "chat", blockType: "skill" }), "");
  assert.equal(categoryOf({ category: "coding", blockType: "skill" }), "coding");
});

test("every category declares at least one known content type", () => {
  for (const category of CATEGORIES) {
    assert.ok(category.blocks?.length, `${category.id} 缺少 blocks`);
    for (const block of category.blocks) assert.ok(BLOCKS.includes(block), `${category.id} 包含未知 block ${block}`);
  }
});

test("scoped prompts do not leak categories from other content types", () => {
  const prompt = tagVocabularyPrompt("skill");
  assert.match(prompt, /design（设计）/);
  assert.doesNotMatch(prompt, /chat（通用对话）/);
  assert.doesNotMatch(prompt, /infra（基础设施）/);
});
