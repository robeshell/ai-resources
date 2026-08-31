import type { EnabledContentBlockId } from "@/lib/content-blocks";

export function curatorEditorHref(block: EnabledContentBlockId, slug: string) {
  const query = new URLSearchParams({ block, slug });
  return `/curator/editor/?${query.toString()}`;
}
