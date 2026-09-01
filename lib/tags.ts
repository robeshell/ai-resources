import taxonomyJson from "@/data/taxonomy.json";
import type { Locale, Localized } from "./types";

export type TaxonomyEntry = {
  id: string;
  label: Localized;
  hint: string;
};

export const CATEGORIES = taxonomyJson.categories as TaxonomyEntry[];
export const TAGS = taxonomyJson.tags as TaxonomyEntry[];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const TAG_BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));

export function knownCategory(id: string): TaxonomyEntry | undefined {
  return CATEGORY_BY_ID.get(id);
}

export function knownTag(id: string): TaxonomyEntry | undefined {
  return TAG_BY_ID.get(id);
}

export function tagLabel(id: string, locale: Locale): string {
  return TAG_BY_ID.get(id)?.label[locale] ?? id;
}

export function sortTags(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort((a, b) => {
    const left = TAG_BY_ID.get(a);
    const right = TAG_BY_ID.get(b);
    if (!left && !right) return a.localeCompare(b);
    if (!left) return 1;
    if (!right) return -1;
    return TAGS.indexOf(left) - TAGS.indexOf(right);
  });
}

/** Read old records too: category used to live among tags. */
export function categoryOf(item: { category?: string; tags?: readonly string[] }): string {
  if (item.category && CATEGORY_BY_ID.has(item.category)) return item.category;
  return item.tags?.find((id) => CATEGORY_BY_ID.has(id)) ?? "";
}

/** Remove legacy category ids from tags while preserving proposed tags. */
export function attributeTags(ids: readonly string[]): string[] {
  return sortTags(ids.filter((id) => !CATEGORY_BY_ID.has(id)));
}

export function usedCategories(items: ReadonlyArray<{ category?: string; tags?: readonly string[] }>): string[] {
  const used = new Set(items.map(categoryOf).filter(Boolean));
  return CATEGORIES.map((category) => category.id).filter((id) => used.has(id));
}

export function usedTags(items: ReadonlyArray<{ tags?: readonly string[] }>): string[] {
  const used = new Set<string>();
  for (const item of items) for (const tag of item.tags ?? []) used.add(tag);
  return attributeTags([...used]);
}
