import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai/providers/faux";
import { loadPiGatewayConfig, normalizeAnthropicSseLine, publicPiProjectConfig, runCuratorConversation, runCuratorDraft, writePiProjectConfig } from "./curator-pi-agent.mjs";

test("Pi gateway config is stored in the project-local private file", async () => {
  const directory = await mkdtemp("/tmp/curator-pi-");
  const file = path.join(directory, ".curator", "pi-config.json");
  await writePiProjectConfig({
    baseUrl: "http://localhost:5173/api/agent/",
    apiKey: "secret-key",
    defaultModel: "deepseek-v4-flash",
    contextWindow: 64000,
    maxTokens: 4096,
  }, { file });
  const config = await loadPiGatewayConfig({ file });
  const visible = publicPiProjectConfig({ apiKey: "secret-key", baseUrl: config.model.baseUrl, defaultModel: config.model.id });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(config.model.baseUrl, "http://localhost:5173/api/agent");
  assert.equal(config.model.id, "deepseek-v4-flash");
  assert.equal(config.model.contextWindow, 64000);
  assert.equal(config.model.maxTokens, 4096);
  assert.equal(visible.apiKeyHint, "••••-key");
  assert.equal("apiKey" in visible, false);
});

test("Pi gateway config does not fall back to computer-wide settings", async () => {
  const directory = await mkdtemp("/tmp/curator-pi-empty-");
  await assert.rejects(
    loadPiGatewayConfig({ file: path.join(directory, ".curator", "pi-config.json") }),
    /系统页设置/,
  );
});

test("Pi strips a configured /v1 suffix before handing the base URL to Anthropic SDK", async () => {
  const directory = await mkdtemp("/tmp/curator-pi-v1-");
  const file = path.join(directory, ".curator", "pi-config.json");
  await writePiProjectConfig({
    baseUrl: "https://gateway.example/api/agent/v1",
    apiKey: "secret-key",
    defaultModel: "deepseek-v4-flash",
  }, { file });

  const config = await loadPiGatewayConfig({ file });
  assert.equal(config.model.baseUrl, "https://gateway.example/api/agent");
  assert.equal(publicPiProjectConfig(JSON.parse(await readFile(file, "utf8"))).baseUrl, "https://gateway.example/api/agent/v1");
});

test("compatible Anthropic streams get missing usage counters normalized", () => {
  const line = normalizeAnthropicSseLine('data: {"type":"message_start","message":{"id":"one","model":"demo"}}');
  const payload = JSON.parse(line.slice(6));
  assert.equal(payload.message.usage.input_tokens, 0);
  assert.equal(payload.message.usage.output_tokens, 0);
});

test("ordinary conversation replies without triggering reorganization", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([fauxAssistantMessage("这段摘要的问题是信息层级不清晰。")]);
  const result = await runCuratorConversation({
    text: "这段摘要有什么问题？",
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.action, { type: "reply" });
  assert.equal(result.text, "这段摘要的问题是信息层级不清晰。");
});

test("an acknowledgement after a completed result cannot restart reorganization", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([fauxAssistantMessage("好的，需要调整时再告诉我。")]);
  const result = await runCuratorConversation({
    text: "好的",
    conversationMessages: [
      { role: "assistant", kind: "run", text: "这份建议已经在编辑器里了，记得保存。", createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.action, { type: "reply" });
  assert.equal(result.text, "好的，需要调整时再告诉我。");
});

test("praise is conversation and cannot trigger reorganization", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([fauxAssistantMessage("谢谢认可。")]);
  const result = await runCuratorConversation({
    text: "你做得很好",
    conversationMessages: [
      { role: "assistant", kind: "run", text: "这份建议已经在编辑器里了，记得保存。", createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.action, { type: "reply" });
  assert.equal(result.text, "谢谢认可。");
});

test("a bare confirmation cannot authorize reorganization from conversation history", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([fauxAssistantMessage("如果要执行，请直接说明要重新整理。")]);
  const result = await runCuratorConversation({
    text: "ok",
    conversationMessages: [
      { role: "assistant", text: "要现在发起重新整理吗？", createdAt: "2026-09-01T00:00:00.000Z" },
    ],
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.action, { type: "reply" });
  assert.equal(result.text, "如果要执行，请直接说明要重新整理。");
});

test("persisted assistant text is rehydrated as a complete Pi message", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([fauxAssistantMessage("你好，有什么想调整的？")]);
  const result = await runCuratorConversation({
    text: "你好啊",
    conversationMessages: [
      { role: "user", text: "上次做了什么？", createdAt: "2026-09-01T00:00:00.000Z" },
      { role: "assistant", text: "上次整理了摘要。", createdAt: "2026-09-01T00:00:01.000Z" },
    ],
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.equal(result.text, "你好，有什么想调整的？");
  assert.deepEqual(result.action, { type: "reply" });
});

test("explicit full reorganization becomes a controlled action", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("reorganize_resource", { instruction: "按最新官网信息全面重新整理" })], { stopReason: "toolUse" }),
  ]);
  const result = await runCuratorConversation({
    text: "按最新官网重新整理一遍",
    item: { id: "one", title: "示例", blockType: "tool", payload: {} },
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.action, { type: "reorganize", instruction: "按最新官网信息全面重新整理" });
});

test("Pi draft workflow ends through the structured submit tool", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("submit_draft", { name: "Example", slug: "example" })], { stopReason: "toolUse" }),
  ]);
  const result = await runCuratorDraft({
    prompt: "整理示例",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "slug"],
      properties: { name: { type: "string" }, slug: { type: "string" } },
    },
    allowNetwork: false,
    model: faux.getModel(),
    streamFn: models.streamSimple.bind(models),
  });
  assert.deepEqual(result.draft, { name: "Example", slug: "example" });
});

test("Pi forces a structured second turn when research ends as plain text", async () => {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses([
    fauxAssistantMessage("研究完成，但先错误地输出了普通文本。"),
    fauxAssistantMessage([fauxToolCall("submit_draft", { name: "Recovered" })], { stopReason: "toolUse" }),
  ]);
  const events = [];
  const requests = [];
  const result = await runCuratorDraft({
    prompt: "整理示例",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name"],
      properties: { name: { type: "string" } },
    },
    allowNetwork: true,
    model: faux.getModel(),
    streamFn: (model, context, options) => {
      requests.push(options);
      return models.streamSimple(model, context, options);
    },
    onEvent: (event) => events.push(event),
  });
  assert.deepEqual(result.draft, { name: "Recovered" });
  assert.ok(events.some((event) => event.type === "submission.started"));
  assert.ok(events.some((event) => event.type === "draft.delta"));
  assert.ok(!events.some((event) => event.type === "text.delta"), "整理过程不能伪装成对话回复");
  assert.equal(requests[0].reasoning, "low");
  assert.equal(requests[1].reasoning, undefined);
  assert.deepEqual(requests[1].toolChoice, { type: "tool", name: "submit_draft" });
});
