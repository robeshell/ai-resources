import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createContentRepository, openContentDb } from "./curator-db.mjs";
import { validateContentPayload } from "./curator-content-rules.mjs";
import { sortTags } from "./curator-tags.mjs";
import { parseList } from "./curator-batch.mjs";
import { exportContent } from "./curator-export.mjs";

function tool(id, status) {
  const at = new Date().toISOString();
  return {
    id,
    blockType: "tool",
    slug: id,
    title: id,
    status,
    category: "coding",
    tags: ["free", "web"],
    createdAt: at,
    updatedAt: at,
    payload: {
      tagline: { zh: "测试定位", en: "Test verdict" },
      summary: { zh: "测试摘要内容", en: "Test summary content" },
      description: { zh: "第一段短详情。\n\n第二段说明边界。", en: "A short first paragraph.\n\nA second paragraph with the boundary." },
      url: `https://${id}.example.com`,
    },
  };
}

function skill(id, status, body) {
  const at = new Date().toISOString();
  return {
    id,
    blockType: "skill",
    slug: id,
    title: id,
    status,
    category: "coding",
    tags: [],
    createdAt: at,
    updatedAt: at,
    payload: { summary: { zh: "技能摘要", en: "Skill summary" }, body, links: [] },
  };
}

async function withRepository(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "curator-content-test-"));
  const dbFile = path.join(root, "content.sqlite");
  const db = await openContentDb({ file: dbFile });
  try {
    await run(createContentRepository(db), { root, dbFile });
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

async function missing(file) {
  return stat(file).then(() => false).catch(() => true);
}

test("drafts never reach the public export", async () => {
  await withRepository(async (repository, { root, dbFile }) => {
    repository.save(tool("published-tool", "active"));
    repository.save(tool("draft-tool", "draft"));
    repository.save(tool("archived-tool", "archived"));
    repository.save(skill("published-skill", "active", "# 正文"));
    repository.save(skill("draft-skill", "draft", ""));

    const outputRoot = path.join(root, "out");
    await exportContent({ outputRoot, dbFile, write: true });

    const tools = JSON.parse(await readFile(path.join(outputRoot, "data/tools.json"), "utf8"));
    const bySlug = Object.fromEntries(tools.items.map((item) => [item.slug, item.status]));
    assert.deepEqual(bySlug, { "published-tool": "active", "archived-tool": "archived" });
    assert.equal(tools.items.find((item) => item.slug === "published-tool").description.zh, "第一段短详情。\n\n第二段说明边界。");

    assert.ok(await missing(path.join(outputRoot, "content/skills/draft-skill.md")));
    assert.ok(!(await missing(path.join(outputRoot, "content/skills/published-skill.md"))));
  });
});

test("--include-drafts exports drafts under their real status", async () => {
  await withRepository(async (repository, { root, dbFile }) => {
    repository.save(tool("draft-tool", "draft"));
    const outputRoot = path.join(root, "out");
    await exportContent({ outputRoot, dbFile, includeDrafts: true, write: true });
    const tools = JSON.parse(await readFile(path.join(outputRoot, "data/tools.json"), "utf8"));
    assert.equal(tools.items[0].status, "draft");
  });
});

test("a batch that fails partway leaves nothing written", async () => {
  await withRepository(async (repository) => {
    repository.save(tool("alpha", "draft"));
    repository.save(skill("beta", "draft", ""));

    const ids = ["alpha", "beta"];
    const status = "active";
    // Same order the /content/batch route uses: validate everything first, then
    // write once. "beta" has no body, so publishing the batch must be refused.
    assert.throws(() => {
      const entries = ids.map((id) => {
        const current = repository.get(id);
        const next = { ...current, status };
        validateContentPayload(next);
        return { item: next, expectedRevisionId: current.revision?.id };
      });
      repository.saveMany(entries);
    }, /已发布的长文必须填写正文/);

    assert.equal(repository.get("alpha").status, "draft");
    assert.equal(repository.get("beta").status, "draft");
  });
});

test("saveMany rolls back every write when one entry is stale", async () => {
  await withRepository(async (repository) => {
    repository.save(tool("alpha", "draft"));
    repository.save(tool("beta", "draft"));
    const alpha = repository.get("alpha");
    const beta = repository.get("beta");

    assert.throws(() => repository.saveMany([
      { item: { ...alpha, status: "active" }, expectedRevisionId: alpha.revision.id },
      { item: { ...beta, status: "active" }, expectedRevisionId: beta.revision.id - 99 },
    ]), /其他窗口更新/);

    assert.equal(repository.get("alpha").status, "draft");
    assert.equal(repository.get("alpha").revision.id, alpha.revision.id);
  });
});

test("publishing enforces what the public build requires", () => {
  const complete = tool("complete", "active");
  assert.doesNotThrow(() => validateContentPayload(complete));

  const cases = [
    [{ ...complete, payload: { ...complete.payload, summary: { zh: "只有中文", en: "" } } }, /中英文简介/],
    [{ ...complete, payload: { ...complete.payload, tagline: { zh: "", en: "en only" } } }, /中英文定位/],
    [{ ...complete, payload: { ...complete.payload, url: "not-a-url" } }, /完整的 http/],
    [{ ...complete, payload: { ...complete.payload, url: "http://127.0.0.1/x" } }, /内网或保留地址/],
    [{ ...complete, category: "" }, /有效的二级分类/],
    [{ ...complete, tags: ["coding", "free"] }, /二级分类不能放在卡片标签中/],
    [skill("empty", "active", "  "), /已发布的长文必须填写正文/],
  ];
  for (const [item, message] of cases) assert.throws(() => validateContentPayload(item), message);

  // Drafts stay editable while incomplete; only links are always checked.
  assert.doesNotThrow(() => validateContentPayload(skill("draft", "draft", "")));
  assert.throws(
    () => validateContentPayload({ ...skill("draft", "draft", ""), payload: { links: [{ label: "站点", url: "javascript:alert(1)" }] } }),
    /只支持 http 和 https 链接/,
  );
  assert.throws(
    () => validateContentPayload({ ...skill("draft", "draft", ""), payload: { links: [{ label: "", url: "https://example.com" }] } }),
    /名称和地址/,
  );
});

test("the vocabulary is internally consistent and shared by both sides", () => {
  const vocabulary = JSON.parse(readFileSync(new URL("../data/taxonomy.json", import.meta.url), "utf8"));
  const seen = new Set();
  for (const entry of [...vocabulary.categories, ...vocabulary.tags]) {
    assert.match(entry.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${entry.id} 不是合法 id`);
    assert.ok(entry.label.zh && entry.label.en, `${entry.id} 缺少中英文名`);
    assert.ok(!seen.has(entry.id), `${entry.id} 重复`);
    seen.add(entry.id);
  }
  assert.deepEqual(sortTags(["web", "free", "china", "self-host"]), ["self-host", "china", "free", "web"]);
  assert.deepEqual(sortTags(["zzz-proposed", "free"]), ["free", "zzz-proposed"]);
});

test("the batch list parser rejects junk instead of ingesting it", () => {
  const { entries, problems } = parseList([
    "# 注释",
    "",
    "tool | https://claude.ai | 备注",
    "project | https://github.com/openclaw/openclaw |",
    "widget | https://example.com |",
    "tool | example.com |",
  ].join("\n"));
  assert.deepEqual(entries.map((entry) => entry.block), ["tool", "project"]);
  assert.equal(entries[0].note, "备注");
  assert.equal(entries[1].note, "");
  // A typo'd board or a bare hostname is worth one loud line, not 70 Agent runs
  // that all save to the wrong place.
  assert.equal(problems.length, 2);
  assert.match(problems[0], /板块「widget」不认识/);
  assert.match(problems[1], /不是 http\(s\) 开头/);
});
