import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** data/taxonomy.json is the single vocabulary shared by browser and scripts. */
const taxonomy = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/taxonomy.json", import.meta.url)), "utf8"),
);

export const CATEGORIES = taxonomy.categories;
export const TAGS = taxonomy.tags;

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const TAG_BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));

export function categoriesForBlock(block) {
  return CATEGORIES.filter((category) => category.blocks?.includes(block));
}

export function knownCategory(id, block) {
  const category = CATEGORY_BY_ID.get(id);
  return category && (!block || category.blocks?.includes(block)) ? category : undefined;
}

export function knownTag(id) {
  return TAG_BY_ID.get(id);
}

export function sortTags(ids) {
  return [...new Set(ids.map(String))].sort((a, b) => {
    const left = TAG_BY_ID.get(a);
    const right = TAG_BY_ID.get(b);
    if (!left && !right) return a.localeCompare(b);
    if (!left) return 1;
    if (!right) return -1;
    return TAGS.indexOf(left) - TAGS.indexOf(right);
  });
}

export function proposedTags(ids) {
  return sortTags(ids).filter((id) => !TAG_BY_ID.has(id));
}

export function categoryOf(item = {}, block = item.blockType) {
  if (item.category && knownCategory(String(item.category), block)) return String(item.category);
  return (item.tags || []).map(String).find((id) => knownCategory(id, block)) || "";
}

export function attributeTags(ids = []) {
  return sortTags(ids).filter((id) => !CATEGORY_BY_ID.has(id));
}

export function tagVocabularyPrompt(block = "auto") {
  const categories = block === "auto"
    ? ["tool", "skill", "project", "site", "prompt"].flatMap((item) => [
        `  ${item}:`,
        ...categoriesForBlock(item).map((category) => `    ${category.id}（${category.label.zh}）：${category.hint}`),
      ])
    : categoriesForBlock(block).map((category) => `  ${category.id}（${category.label.zh}）：${category.hint}`);
  const tags = TAGS.map((tag) => `  ${tag.id}（${tag.label.zh}）：${tag.hint}`);
  return `二级分类（写入 category）— 必须从当前 blockType 对应的栏目中且只能选一个。\n${categories.join("\n")}\n\n标签（写入 tags）— 所有标签平级、独立多选，没有互斥规则。\n${tags.join("\n")}`;
}
