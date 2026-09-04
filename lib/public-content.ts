import fs from "node:fs";
import path from "node:path";
import type { ContentBlockId, ContentLink, PromptExample, PromptVariable } from "./content-blocks";
import type { Localized } from "./types";
import { attributeTags, categoryOf } from "./tags";

export type PublicContentSummary = {
  id: string;
  blockType: "skill" | "project" | "site" | "prompt";
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: Localized;
  logo?: string;
};

export type PublicContentDocument = PublicContentSummary & {
  sourceUrl?: string;
  url?: string;
  description?: Localized;
  body: Localized;
  links: ContentLink[];
  prompt?: string;
  variables?: PromptVariable[];
  examples?: PromptExample[];
};

const ROOT = process.cwd();
const PUBLIC_BLOCKS = ["skill", "project", "site", "prompt"] as const;

function directory(block: (typeof PUBLIC_BLOCKS)[number]) {
  return path.join(ROOT, "content", `${block}s`);
}

/** 正文早期是单个中文字符串，也允许 `---` 之后的正文作为唯一来源。两种旧形态都折进 zh。 */
function readBody(value: unknown, trailing: string): Localized {
  if (value && typeof value === "object") {
    const body = value as Partial<Localized>;
    return { zh: String(body.zh || "").trim(), en: String(body.en || "").trim() };
  }
  return { zh: String(value || trailing || "").trim(), en: "" };
}

function parseFile(file: string): PublicContentDocument | null {
  const raw = fs.readFileSync(file, "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const meta = JSON.parse(match[1]) as {
    id: string;
    slug: string;
    blockType: ContentBlockId;
    title: string;
    status: string;
    category?: string;
    tags?: string[];
    sourceUrl?: string;
    payload?: Record<string, unknown>;
  };
  if (!PUBLIC_BLOCKS.includes(meta.blockType as (typeof PUBLIC_BLOCKS)[number]) || meta.status !== "active") return null;
  const payload = meta.payload || {};
  const summary = payload.summary as Localized | undefined;
  return {
    id: meta.id,
    blockType: meta.blockType as PublicContentDocument["blockType"],
    slug: meta.slug,
    title: meta.title,
    category: categoryOf({ category: meta.category, tags: meta.tags }, meta.blockType as PublicContentDocument["blockType"]),
    tags: attributeTags(Array.isArray(meta.tags) ? meta.tags.map(String) : []),
    summary: summary || { en: meta.title, zh: meta.title },
    ...(meta.sourceUrl ? { sourceUrl: meta.sourceUrl } : {}),
    ...(typeof payload.logo === "string" && payload.logo ? { logo: payload.logo } : {}),
    ...(typeof payload.url === "string" ? { url: payload.url } : {}),
    ...(payload.description && typeof payload.description === "object" ? { description: payload.description as Localized } : {}),
    body: readBody(payload.body, match[2]),
    links: Array.isArray(payload.links) ? payload.links as ContentLink[] : [],
    ...(typeof payload.prompt === "string" ? { prompt: payload.prompt } : {}),
    ...(Array.isArray(payload.variables) ? { variables: payload.variables as PromptVariable[] } : {}),
    ...(Array.isArray(payload.examples) ? { examples: payload.examples as PromptExample[] } : {}),
  };
}

export function loadPublicContent(block?: PublicContentDocument["blockType"]): PublicContentDocument[] {
  const blocks = block ? [block] : [...PUBLIC_BLOCKS];
  return blocks.flatMap((entry) => {
    const dir = directory(entry);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((name) => name.endsWith(".md")).map((name) => parseFile(path.join(dir, name))).filter(Boolean) as PublicContentDocument[];
  });
}

export function loadPublicContentItem(block: PublicContentDocument["blockType"], slug: string) {
  return loadPublicContent(block).find((item) => item.slug === slug);
}
