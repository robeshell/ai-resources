import tagsJson from "@/data/tags.json";
import type { Locale, Localized } from "./types";

export type TagGroupId = "task" | "trait" | "pricing" | "platform";

export type TagDefinition = {
  id: string;
  group: TagGroupId;
  label: Localized;
  hint: string;
};

export type TagGroup = {
  id: TagGroupId;
  label: Localized;
};

export const TAG_GROUPS = tagsJson.groups as TagGroup[];
export const TAGS = tagsJson.tags as TagDefinition[];

const BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));
/** Group order in the file is the display order: 用途 first, platform last. */
const GROUP_ORDER = new Map(TAG_GROUPS.map((group, index) => [group.id, index]));

export function knownTag(id: string): TagDefinition | undefined {
  return BY_ID.get(id);
}

/** Unknown ids render as themselves: an Agent may propose a tag the vocabulary
 *  does not have yet, and hiding it would make the proposal invisible. */
export function tagLabel(id: string, locale: Locale): string {
  return BY_ID.get(id)?.label[locale] ?? id;
}

/** Vocabulary order, then unknown ids last — so a card's tags always read
 *  用途 → 特性 → 定价 → 平台 regardless of the order they were saved in. */
export function sortTags(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => {
    const left = BY_ID.get(a);
    const right = BY_ID.get(b);
    if (!left && !right) return a.localeCompare(b);
    if (!left) return 1;
    if (!right) return -1;
    const byGroup = (GROUP_ORDER.get(left.group) ?? 99) - (GROUP_ORDER.get(right.group) ?? 99);
    if (byGroup !== 0) return byGroup;
    return TAGS.indexOf(left) - TAGS.indexOf(right);
  });
}

/** Undefined for a tag an Agent proposed but nobody has filed yet. */
export function tagGroup(id: string): TagGroupId | undefined {
  return BY_ID.get(id)?.group;
}

export function tagsInGroup(group: TagGroupId): TagDefinition[] {
  return TAGS.filter((tag) => tag.group === group);
}

/** Tags actually present across a set of items, kept in vocabulary order, so a
 *  filter bar only ever offers what would return something. */
export function usedTags(items: ReadonlyArray<{ tags?: readonly string[] }>): string[] {
  const used = new Set<string>();
  for (const item of items) for (const tag of item.tags ?? []) used.add(tag);
  return sortTags([...used]);
}
