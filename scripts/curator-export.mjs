import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createContentRepository, importLegacyCatalog, openContentDb } from "./curator-db.mjs";
import { attributeTags, categoryOf } from "./curator-tags.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = path.resolve(process.env.CURATOR_CONTENT_DB || path.join(ROOT, ".curator", "content.sqlite"));

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function legacyTool(item) {
  const payload = item.payload || {};
  return {
    id: item.id,
    slug: item.slug,
    name: item.title,
    url: String(payload.url || item.sourceUrl || ""),
    ...(payload.logo ? { logo: payload.logo } : {}),
    category: categoryOf(item),
    tags: attributeTags(item.tags || []),
    status: item.status,
    verdict: payload.tagline,
    summary: payload.summary,
    ...(payload.description ? { description: payload.description } : {}),
  };
}

function markdownDocument(item) {
  const payload = item.payload || {};
  const frontmatter = {
    id: item.id,
    slug: item.slug,
    blockType: item.blockType,
    title: item.title,
    status: item.status,
    category: categoryOf(item),
    tags: attributeTags(item.tags || []),
    ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
    payload,
  };
  // frontmatter 里两种语言都在；`---` 之后只写中文正文，让文件在编辑器里仍然可读。
  const body = typeof payload.body === "object" ? payload.body?.zh : payload.body;
  return `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${String(body || "").trim()}\n`;
}

async function ensureDb(file) {
  try {
    await fs.access(file);
  } catch {
    await importLegacyCatalog({ file, dryRun: false });
  }
  return openContentDb({ file });
}

export async function exportContent({ outputRoot = ROOT, dbFile = DB_FILE, includeDrafts = false, write = false } = {}) {
  const db = await ensureDb(dbFile);
  const repository = createContentRepository(db);
  const items = repository.list();
  // Drafts stay in SQLite. tools.json is a public artefact (and the cold-start
  // import source), so a rule-fallback draft must never land in it — the site
  // publishes every non-archived entry it finds there.
  const published = (item) => includeDrafts || item.status !== "draft";
  const tools = items.filter((item) => item.blockType === "tool" && published(item));
  const longForm = items.filter((item) => item.blockType !== "tool" && (includeDrafts || item.status === "active"));
  const files = [
    { path: path.join(outputRoot, "data/tools.json"), content: `${JSON.stringify({ items: tools.map(legacyTool) }, null, 2)}\n` },
    ...longForm.map((item) => ({
      path: path.join(outputRoot, "content", `${item.blockType}s`, `${item.slug}.md`),
      content: markdownDocument(item),
    })),
  ];
  if (write) {
    await fs.mkdir(path.join(outputRoot, "data"), { recursive: true });
    await fs.rm(path.join(outputRoot, "data", "resources.json"), { force: true });
    for (const block of ["skill", "project", "site", "prompt", "course", "article"]) {
      await fs.rm(path.join(outputRoot, "content", `${block}s`), { recursive: true, force: true });
    }
    for (const file of files) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.content, "utf8");
    }
  }
  db.close();
  return {
    write,
    outputRoot,
    source: dbFile,
    items: items.length,
    tools: tools.length,
    longForm: longForm.length,
    draftsIncluded: includeDrafts,
    files: files.map((file) => path.relative(outputRoot, file.path)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exportContent({
    outputRoot: path.resolve(argValue("--out-dir", ROOT)),
    includeDrafts: process.argv.includes("--include-drafts"),
    write: process.argv.includes("--write"),
  })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.write) console.log("Dry run only. Use --write to update export files.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
