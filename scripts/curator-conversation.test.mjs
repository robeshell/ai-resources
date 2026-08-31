import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createContentRepository, openContentDb } from "./curator-db.mjs";

function tool(id, at) {
  return {
    id,
    blockType: "tool",
    slug: id,
    title: id,
    status: "draft",
    tags: ["coding", "free", "web"],
    createdAt: at,
    updatedAt: at,
    payload: {
      tagline: { zh: "测试定位", en: "Test verdict" },
      summary: { zh: "测试摘要内容", en: "Test summary content" },
      url: `https://${id}.example.com`,
    },
  };
}

test("conversation repository keeps one conversation per content item and one result per run", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "curator-conversation-test-"));
  try {
    const db = await openContentDb({ file: path.join(temporaryRoot, "content.sqlite") });
    const repository = createContentRepository(db);
    const at = new Date().toISOString();
    repository.save(tool("alpha", at));
    repository.save(tool("beta", at));

    const first = repository.createConversation({ contentId: "alpha" });
    const same = repository.createConversation({ contentId: "alpha" });
    assert.equal(same.id, first.id);

    repository.addMessage(first.id, { role: "user", text: "请更新", data: { runId: "run-1" } });
    const result = repository.addMessage(first.id, {
      role: "assistant",
      kind: "run",
      text: "整理完成",
      data: { runId: "run-1", status: "awaiting_review" },
      runId: "run-1",
    });
    const duplicate = repository.addMessage(first.id, {
      role: "assistant",
      kind: "run",
      text: "不应重复",
      runId: "run-1",
    });
    assert.equal(duplicate.id, result.id);
    assert.equal(repository.getConversation(first.id).messages.length, 2);

    const unbound = repository.createConversation();
    assert.throws(() => repository.bindConversation(unbound.id, "alpha"), /已经绑定了其他会话/);
    repository.bindConversation(unbound.id, "beta");
    assert.equal(repository.getConversation(unbound.id).contentId, "beta");
    db.close();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
