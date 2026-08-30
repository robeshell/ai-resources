import fs from "node:fs";
import path from "node:path";
// Node 22 provides this built-in module; the project still carries Node 20 type declarations.
// @ts-expect-error node:sqlite is available in the Curator runtime.
import { DatabaseSync } from "node:sqlite";
import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/curator/ContentEditor";
import { ENABLED_CONTENT_BLOCK_IDS, isEnabledContentBlockId } from "@/lib/content-blocks";

export function generateStaticParams() {
  const params: Array<{ block: string; slug: string }> = ENABLED_CONTENT_BLOCK_IDS.map((block) => ({ block, slug: "new" }));
  const databasePath = path.join(process.cwd(), ".curator", "content.sqlite");
  if (!fs.existsSync(databasePath)) return params;
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database.prepare("SELECT block_type, slug FROM content_items WHERE block_type IN ('tool', 'skill', 'project', 'prompt')").all() as Array<{ block_type: string; slug: string }>;
    return [...params, ...rows.map((row) => ({ block: row.block_type, slug: row.slug }))];
  } finally {
    database.close();
  }
}

export const dynamicParams = false;

export default async function CuratorContentEditorPage({ params }: { params: Promise<{ block: string; slug: string }> }) {
  const { block, slug } = await params;
  if (!isEnabledContentBlockId(block)) notFound();
  return <ContentEditor block={block} slug={decodeURIComponent(slug)} />;
}
