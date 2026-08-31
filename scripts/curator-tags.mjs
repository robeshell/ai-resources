import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** data/tags.json is the single vocabulary; the browser reads it through
 *  lib/tags.ts and the Curator scripts read it here. Neither side keeps its
 *  own copy, so adding a tag is a one-file change. */
const vocabulary = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/tags.json", import.meta.url)), "utf8"),
);

export const TAG_GROUPS = vocabulary.groups;
export const TAGS = vocabulary.tags;

const BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));
const GROUP_ORDER = new Map(TAG_GROUPS.map((group, index) => [group.id, index]));

export function knownTag(id) {
  return BY_ID.get(id);
}

export function tagsInGroup(group) {
  return TAGS.filter((tag) => tag.group === group);
}

/** Vocabulary order first, proposed tags last — the same ordering the site
 *  uses, so a card reads the same before and after export. */
export function sortTags(ids) {
  return [...new Set(ids.map(String))].sort((a, b) => {
    const left = BY_ID.get(a);
    const right = BY_ID.get(b);
    if (!left && !right) return a.localeCompare(b);
    if (!left) return 1;
    if (!right) return -1;
    const byGroup = (GROUP_ORDER.get(left.group) ?? 99) - (GROUP_ORDER.get(right.group) ?? 99);
    return byGroup !== 0 ? byGroup : TAGS.indexOf(left) - TAGS.indexOf(right);
  });
}

/** Tags outside the vocabulary. An Agent is allowed to propose one, so these
 *  are kept and surfaced rather than dropped. */
export function proposedTags(ids) {
  return sortTags(ids).filter((id) => !BY_ID.get(id));
}

/** The vocabulary as prompt text: id, label and hint, grouped, plus how many
 *  of each group to pick. Agents get the real table instead of a paraphrase. */
export function tagVocabularyPrompt() {
  return TAG_GROUPS.map((group) => {
    const lines = tagsInGroup(group.id).map((tag) => `  ${tag.id}（${tag.label.zh}）：${tag.hint}`);
    return `${group.label.zh} — ${group.note}\n${lines.join("\n")}`;
  }).join("\n\n");
}
