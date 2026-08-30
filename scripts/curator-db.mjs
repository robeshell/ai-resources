import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB_FILE = path.join(ROOT, ".curator", "content.sqlite");
const LEGACY_FILES = [
  { blockType: "tool", file: path.join(ROOT, "data/tools.json") },
];

export const CONTENT_SCHEMA_VERSION = 5;

const MIGRATIONS = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS content_items (
        id TEXT PRIMARY KEY NOT NULL,
        block_type TEXT NOT NULL CHECK (block_type IN ('tool', 'skill', 'project', 'prompt', 'course', 'article')),
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
        category TEXT NOT NULL,
        tags_json TEXT NOT NULL DEFAULT '[]',
        source_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        current_revision_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS content_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
        revision_kind TEXT NOT NULL CHECK (revision_kind IN ('import', 'manual', 'ai_candidate')),
        revision_status TEXT NOT NULL CHECK (revision_status IN ('current', 'candidate', 'superseded', 'abandoned')),
        payload_json TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL DEFAULT 'curator',
        parent_revision_id INTEGER REFERENCES content_revisions(id)
      );

      CREATE TABLE IF NOT EXISTS content_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        url TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'other',
        ordinal INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS content_tags (
        item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (item_id, tag)
      );

      CREATE TABLE IF NOT EXISTS ai_runs (
        id TEXT PRIMARY KEY NOT NULL,
        item_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
        block_type TEXT NOT NULL,
        status TEXT NOT NULL,
        source_url TEXT,
        agent TEXT,
        model TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_run_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        phase TEXT NOT NULL,
        type TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (run_id, sequence)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_content_items_block_status
        ON content_items(block_type, status);
      CREATE INDEX IF NOT EXISTS idx_content_revisions_item_status
        ON content_revisions(item_id, revision_status);
      CREATE INDEX IF NOT EXISTS idx_ai_run_events_run_sequence
        ON ai_run_events(run_id, sequence);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE content_items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      UPDATE content_items SET sort_order = rowid WHERE sort_order = 0;
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE content_items DROP COLUMN category;
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        kind TEXT NOT NULL DEFAULT 'text',
        text TEXT NOT NULL DEFAULT '',
        data_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv
        ON conversation_messages(conversation_id, id);
      CREATE INDEX IF NOT EXISTS idx_conversations_content
        ON conversations(content_id);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE conversation_messages ADD COLUMN run_id TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_content_unique
        ON conversations(content_id) WHERE content_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_run_unique
        ON conversation_messages(run_id) WHERE run_id IS NOT NULL;
    `,
  },
];

function now() {
  return new Date().toISOString();
}

function ensureDirectory(file) {
  return fs.mkdir(path.dirname(file), { recursive: true });
}

export async function openContentDb({ file = DEFAULT_DB_FILE } = {}) {
  await ensureDirectory(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");

  const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all().map((row) => Number(row.version)));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(migration.version, now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.close();
      throw error;
    }
  }
  return db;
}

function withTransaction(db, callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function hydrateItem(row, revision) {
  if (!row) return null;
  return {
    id: row.id,
    blockType: row.block_type,
    slug: row.slug,
    title: row.title,
    status: row.status,
    tags: JSON.parse(row.tags_json || "[]"),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.sort_order === undefined ? {} : { sortOrder: Number(row.sort_order) }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: revision ? JSON.parse(revision.payload_json) : {},
    ...(revision ? {
      revision: {
        id: Number(revision.id),
        kind: revision.revision_kind,
        status: revision.revision_status,
        createdAt: revision.created_at,
        note: revision.note,
      },
    } : {}),
  };
}

function readItemRow(db, idOrSlug) {
  const row = db.prepare("SELECT * FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(idOrSlug, idOrSlug);
  if (!row) return null;
  const revision = row.current_revision_id
    ? db.prepare("SELECT * FROM content_revisions WHERE id = ?").get(row.current_revision_id)
    : null;
  return hydrateItem(row, revision);
}

function readConversation(db, id) {
  const conv = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
  if (!conv) return null;
  const messages = db.prepare("SELECT * FROM conversation_messages WHERE conversation_id = ? ORDER BY id ASC").all(id)
    .map((message) => ({
      id: Number(message.id),
      role: message.role,
      kind: message.kind,
      text: message.text,
      data: message.data_json ? JSON.parse(message.data_json) : null,
      ...(message.run_id ? { runId: message.run_id } : {}),
      createdAt: message.created_at,
    }));
  return { id: conv.id, title: conv.title, contentId: conv.content_id || null, createdAt: conv.created_at, updatedAt: conv.updated_at, messages };
}

/** Write one item without opening a transaction, so single saves and batch
 *  saves can share the same code while batches stay atomic. */
function saveItemWithin(db, item, { revisionKind = "manual", note = "", expectedRevisionId } = {}) {
  const existing = db.prepare("SELECT * FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(item.id, item.slug);
  if (existing && expectedRevisionId !== undefined && Number(existing.current_revision_id || 0) !== Number(expectedRevisionId)) {
    throw Object.assign(new Error("内容已在其他窗口更新，请重新加载后再保存"), { code: "stale-revision" });
  }
  const itemId = existing?.id || item.id;
  const at = now();
  if (existing) {
    db.prepare(`
      UPDATE content_items
      SET block_type = ?, slug = ?, title = ?, status = ?, tags_json = ?, source_url = ?, updated_at = ?
      WHERE id = ?
    `).run(
      item.blockType,
      item.slug,
      item.title,
      item.status,
      JSON.stringify(item.tags || []),
      item.sourceUrl || null,
      at,
      existing.id,
    );
    if (existing.current_revision_id) {
      db.prepare("UPDATE content_revisions SET revision_status = 'superseded' WHERE id = ?").run(existing.current_revision_id);
    }
  } else {
    const nextSortOrder = item.sortOrder === undefined
      ? Number(db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM content_items").get().next)
      : Number(item.sortOrder);
    db.prepare(`
      INSERT INTO content_items
        (id, block_type, slug, title, status, tags_json, source_url, created_at, updated_at, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.blockType,
      item.slug,
      item.title,
      item.status,
      JSON.stringify(item.tags || []),
      item.sourceUrl || null,
      at,
      at,
      nextSortOrder,
    );
  }
  const revision = db.prepare(`
    INSERT INTO content_revisions
      (item_id, revision_kind, revision_status, payload_json, note, created_at, created_by)
    VALUES (?, ?, 'current', ?, ?, ?, 'curator')
    `).run(itemId, revisionKind, JSON.stringify(item.payload), note, at);
  db.prepare("UPDATE content_items SET current_revision_id = ?, updated_at = ? WHERE id = ?")
    .run(Number(revision.lastInsertRowid), at, itemId);
  db.prepare("DELETE FROM content_links WHERE item_id = ?").run(itemId);
  for (const [ordinal, link] of (item.payload.links || []).entries()) {
    db.prepare("INSERT INTO content_links(item_id, label, url, kind, ordinal) VALUES (?, ?, ?, ?, ?)")
      .run(itemId, link.label, link.url, link.kind || "other", ordinal);
  }
  db.prepare("DELETE FROM content_tags WHERE item_id = ?").run(itemId);
  for (const tag of item.tags || []) {
    db.prepare("INSERT INTO content_tags(item_id, tag) VALUES (?, ?)").run(itemId, tag);
  }
  return readItemRow(db, itemId);
}

export function contentRevisionToken(db) {
  const row = db.prepare("SELECT COALESCE(MAX(current_revision_id), 0) AS revision, COALESCE(MAX(updated_at), '') AS updated FROM content_items").get();
  return `sqlite:${Number(row.revision || 0)}:${row.updated || ""}`;
}

/**
 * Small repository boundary used by the future Curator adapter. It exposes
 * current revisions by default and keeps candidate revisions out of reads.
 */
export function createContentRepository(db) {
  return {
    get(idOrSlug) {
      return readItemRow(db, idOrSlug);
    },
    revisionToken() {
      return contentRevisionToken(db);
    },
    list({ blockType, status } = {}) {
      const filters = [];
      const values = [];
      if (blockType) {
        filters.push("block_type = ?");
        values.push(blockType);
      }
      if (status) {
        filters.push("status = ?");
        values.push(status);
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = db.prepare(`SELECT * FROM content_items ${where} ORDER BY sort_order ASC, id ASC`).all(...values);
      return rows.map((row) => {
        const revision = row.current_revision_id
          ? db.prepare("SELECT * FROM content_revisions WHERE id = ?").get(row.current_revision_id)
          : null;
        return hydrateItem(row, revision);
      });
    },
    save(item, options = {}) {
      return withTransaction(db, () => saveItemWithin(db, item, options));
    },
    /** Batch writes share one transaction so a failure halfway through cannot
     *  leave the database partially updated against the exported files. */
    saveMany(entries, options = {}) {
      return withTransaction(db, () => entries.map((entry) => saveItemWithin(db, entry.item, { ...options, ...entry })));
    },
    createCandidate(itemId, payload, { note = "", createdBy = "agent" } = {}) {
      return withTransaction(db, () => {
        const item = db.prepare("SELECT * FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(itemId, itemId);
        if (!item) throw new Error("找不到对应内容");
        const parentRevisionId = item.current_revision_id || null;
        const revision = db.prepare(`
          INSERT INTO content_revisions
            (item_id, revision_kind, revision_status, payload_json, note, created_at, created_by, parent_revision_id)
          VALUES (?, 'ai_candidate', 'candidate', ?, ?, ?, ?, ?)
        `).run(item.id, JSON.stringify(payload), note, now(), createdBy, parentRevisionId);
        return {
          id: Number(revision.lastInsertRowid),
          itemId: item.id,
          status: "candidate",
          parentRevisionId: parentRevisionId ? Number(parentRevisionId) : undefined,
        };
      });
    },
    applyCandidate(itemId, revisionId, { note = "应用 AI 候选" } = {}) {
      return withTransaction(db, () => {
        const item = db.prepare("SELECT * FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(itemId, itemId);
        if (!item) throw new Error("找不到对应内容");
        const candidate = db.prepare(`
          SELECT * FROM content_revisions
          WHERE id = ? AND item_id = ? AND revision_status = 'candidate'
          LIMIT 1
        `).get(Number(revisionId), item.id);
        if (!candidate) throw new Error("找不到可应用的候选版本");
        const at = now();
        if (item.current_revision_id) {
          db.prepare("UPDATE content_revisions SET revision_status = 'superseded' WHERE id = ?").run(item.current_revision_id);
        }
        db.prepare("UPDATE content_revisions SET revision_status = 'superseded' WHERE id = ?").run(candidate.id);
        const revision = db.prepare(`
          INSERT INTO content_revisions
            (item_id, revision_kind, revision_status, payload_json, note, created_at, created_by, parent_revision_id)
          VALUES (?, 'manual', 'current', ?, ?, ?, 'curator', ?)
        `).run(item.id, candidate.payload_json, note, at, item.current_revision_id || null);
        db.prepare("UPDATE content_items SET current_revision_id = ?, updated_at = ? WHERE id = ?")
          .run(Number(revision.lastInsertRowid), at, item.id);
        const payload = JSON.parse(candidate.payload_json);
        db.prepare("DELETE FROM content_links WHERE item_id = ?").run(item.id);
        for (const [ordinal, link] of (payload.links || []).entries()) {
          db.prepare("INSERT INTO content_links(item_id, label, url, kind, ordinal) VALUES (?, ?, ?, ?, ?)")
            .run(item.id, link.label, link.url, link.kind || "other", ordinal);
        }
        return readItemRow(db, item.id);
      });
    },
    abandonCandidate(itemId, revisionId) {
      return withTransaction(db, () => {
        const item = db.prepare("SELECT id FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(itemId, itemId);
        if (!item) throw new Error("找不到对应内容");
        const result = db.prepare(`
          UPDATE content_revisions
          SET revision_status = 'abandoned'
          WHERE id = ? AND item_id = ? AND revision_status = 'candidate'
        `).run(Number(revisionId), item.id);
        if (!result.changes) throw new Error("找不到可放弃的候选版本");
        return true;
      });
    },
    candidates(itemId) {
      const item = db.prepare("SELECT id FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(itemId, itemId);
      if (!item) return [];
      return db.prepare(`
        SELECT id, revision_kind, revision_status, payload_json, note, created_at, created_by, parent_revision_id
        FROM content_revisions
        WHERE item_id = ? AND revision_status = 'candidate'
        ORDER BY id DESC
      `).all(item.id).map((row) => ({
        id: Number(row.id),
        itemId: item.id,
        kind: row.revision_kind,
        status: row.revision_status,
        payload: JSON.parse(row.payload_json),
        note: row.note,
        createdAt: row.created_at,
        createdBy: row.created_by,
        parentRevisionId: row.parent_revision_id ? Number(row.parent_revision_id) : undefined,
      }));
    },
    remove(idOrSlug) {
      return withTransaction(db, () => {
        const item = db.prepare("SELECT id FROM content_items WHERE id = ? OR slug = ? LIMIT 1").get(idOrSlug, idOrSlug);
        if (!item) return false;
        db.prepare("DELETE FROM content_items WHERE id = ?").run(item.id);
        return true;
      });
    },
    createConversation({ title = "", contentId = null } = {}) {
      return withTransaction(db, () => {
        if (contentId) {
          const item = db.prepare("SELECT id FROM content_items WHERE id = ?").get(contentId);
          if (!item) throw new Error("找不到要绑定的内容");
          const existing = db.prepare("SELECT id FROM conversations WHERE content_id = ?").get(contentId);
          if (existing) return readConversation(db, existing.id);
        }
        const id = randomUUID();
        const at = now();
        db.prepare("INSERT INTO conversations (id, title, content_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(id, title, contentId, at, at);
        return { id, title, contentId, createdAt: at, updatedAt: at, messages: [] };
      });
    },
    getConversation(id) {
      return readConversation(db, id);
    },
    listConversations({ contentId } = {}) {
      const rows = contentId
        ? db.prepare("SELECT * FROM conversations WHERE content_id = ? ORDER BY updated_at DESC").all(contentId)
        : db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all();
      return rows.map((c) => ({ id: c.id, title: c.title, contentId: c.content_id || null, createdAt: c.created_at, updatedAt: c.updated_at }));
    },
    addMessage(conversationId, { role, kind = "text", text = "", data, runId = null } = {}) {
      return withTransaction(db, () => {
        const conv = db.prepare("SELECT id FROM conversations WHERE id = ?").get(conversationId);
        if (!conv) throw new Error("会话不存在");
        if (runId) {
          const existing = db.prepare("SELECT * FROM conversation_messages WHERE run_id = ?").get(runId);
          if (existing) {
            return { id: Number(existing.id), conversationId: existing.conversation_id, role: existing.role, kind: existing.kind, text: existing.text, data: existing.data_json ? JSON.parse(existing.data_json) : null, runId: existing.run_id, createdAt: existing.created_at };
          }
        }
        const at = now();
        const res = db.prepare("INSERT INTO conversation_messages (conversation_id, role, kind, text, data_json, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(conversationId, role, kind, text, data ? JSON.stringify(data) : null, runId, at);
        db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(at, conversationId);
        return { id: Number(res.lastInsertRowid), conversationId, role, kind, text, data: data ?? null, ...(runId ? { runId } : {}), createdAt: at };
      });
    },
    bindConversation(id, contentId) {
      return withTransaction(db, () => {
        const conv = db.prepare("SELECT id, content_id FROM conversations WHERE id = ?").get(id);
        if (!conv) throw new Error("会话不存在");
        const item = db.prepare("SELECT id FROM content_items WHERE id = ?").get(contentId);
        if (!item) throw new Error("找不到要绑定的内容");
        const existing = db.prepare("SELECT id FROM conversations WHERE content_id = ? AND id <> ?").get(contentId, id);
        if (existing) throw new Error("这条内容已经绑定了其他会话");
        db.prepare("UPDATE conversations SET content_id = ?, updated_at = ? WHERE id = ?").run(contentId, now(), id);
        return true;
      });
    },
  };
}

export async function backupContentDb({ file = DEFAULT_DB_FILE, destination } = {}) {
  const source = path.resolve(file);
  const target = path.resolve(destination || `${source}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`);
  await ensureDirectory(target);
  await fs.copyFile(source, target);
  return target;
}

function readLocalized(value) {
  return {
    en: String(value?.en || ""),
    zh: String(value?.zh || ""),
  };
}

function blockTypeForLegacy(item, defaultBlockType) {
  if (defaultBlockType === "tool") return "tool";
  if (item?.kind === "skill") return "skill";
  if (item?.kind === "open-source") return "project";
  return "tool";
}

function migrateLegacyItem(item, defaultBlockType, sortOrder = 0) {
  const blockType = blockTypeForLegacy(item, defaultBlockType);
  const summary = readLocalized(item.summary);
  const tagline = readLocalized(item.verdict);
  const payload = blockType === "tool"
    ? {
        ...(item.logo ? { logo: String(item.logo) } : {}),
        tagline,
        summary,
        url: String(item.url || ""),
        pricing: String(item.pricing || "freemium"),
        platforms: Array.isArray(item.platforms) ? item.platforms.map(String) : [],
      }
    : {
        summary,
        body: "",
        links: item.url ? [{ label: "Official link", url: String(item.url), kind: "official" }] : [],
      };
  const at = now();
  return {
    id: String(item.id || item.slug),
    blockType,
    slug: String(item.slug || item.id),
    title: String(item.name || item.slug || item.id),
    status: item.status === "archived" ? "archived" : blockType === "tool" ? "active" : "draft",
    tags: [],
    sourceUrl: item.url ? String(item.url) : undefined,
    sortOrder,
    createdAt: at,
    updatedAt: at,
    payload,
  };
}

function countLegacy(items) {
  return items.reduce((counts, item) => {
    counts[item.blockType] = (counts[item.blockType] || 0) + 1;
    return counts;
  }, {});
}

/**
 * Read legacy JSON into the new model. The default is a no-write dry run so
 * migration checks cannot accidentally replace the current catalog.
 */
export async function readLegacyCatalog() {
  const entries = [];
  for (const source of LEGACY_FILES) {
    // Retired export targets (resources.json) may no longer exist; a missing
    // file simply contributes nothing instead of failing the fresh-install
    // bootstrap and the CI export.
    if (!await fs.access(source.file).then(() => true).catch(() => false)) continue;
    const data = JSON.parse(await fs.readFile(source.file, "utf8"));
    for (const [sortOrder, item] of (data.items || []).entries()) {
      entries.push(migrateLegacyItem(item, source.blockType, sortOrder));
    }
  }
  return entries;
}

function insertItem(db, item) {
  const existing = db.prepare("SELECT id FROM content_items WHERE slug = ? OR id = ?").get(item.slug, item.id);
  if (existing) return { inserted: false, id: existing.id };

  db.prepare(`
    INSERT INTO content_items
      (id, block_type, slug, title, status, tags_json, source_url, created_at, updated_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.id,
    item.blockType,
    item.slug,
    item.title,
    item.status,
    JSON.stringify(item.tags),
    item.sourceUrl || null,
    item.createdAt,
    item.updatedAt,
    Number(item.sortOrder || 0),
  );
  const revision = db.prepare(`
    INSERT INTO content_revisions
      (item_id, revision_kind, revision_status, payload_json, note, created_at, created_by)
    VALUES (?, 'import', 'current', ?, ?, ?, 'legacy-json')
  `).run(item.id, JSON.stringify(item.payload), "从现有 JSON 导入", item.createdAt);
  db.prepare("UPDATE content_items SET current_revision_id = ? WHERE id = ?").run(Number(revision.lastInsertRowid), item.id);

  for (const [ordinal, link] of (item.payload.links || []).entries()) {
    db.prepare("INSERT INTO content_links(item_id, label, url, kind, ordinal) VALUES (?, ?, ?, ?, ?)")
      .run(item.id, link.label, link.url, link.kind || "other", ordinal);
  }
  return { inserted: true, id: item.id };
}

export async function importLegacyCatalog({ file = DEFAULT_DB_FILE, dryRun = true } = {}) {
  const entries = await readLegacyCatalog();
  const db = await openContentDb({ file: dryRun ? ":memory:" : file });
  const result = {
    dryRun,
    total: entries.length,
    byBlock: countLegacy(entries),
    inserted: 0,
    skipped: 0,
    items: entries.map(({ payload, ...item }) => ({ ...item, payloadKeys: Object.keys(payload) })),
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const entry of entries) {
      const outcome = insertItem(db, entry);
      if (outcome.inserted) result.inserted += 1;
      else result.skipped += 1;
    }
    if (dryRun) db.exec("ROLLBACK");
    else db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  db.close();
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dryRun = !process.argv.includes("--write");
  importLegacyCatalog({ dryRun })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (dryRun) console.log("Dry run only. Use --write to create .curator/content.sqlite.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
