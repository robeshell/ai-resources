import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs, readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  openContentDb,
  createContentRepository,
  importLegacyCatalog,
} from "./curator-db.mjs";
import { exportContent } from "./curator-export.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.CURATOR_PORT || 4317);
const SITE_PORT = process.env.CURATOR_SITE_PORT || "3000";
const SCHEMA_PATH = path.join(ROOT, "scripts/curator-output.schema.json");
const SKILL_PATH = path.join(ROOT, "skills/curator-ingest/SKILL.md");
const MAX_REQUEST_BYTES = 128 * 1024;
const MAX_LOGO_BYTES = 512 * 1024;
const LOGO_TYPES = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};
const KINDS = ["tool", "skill", "open-source", "prompt"];
const INGEST_BLOCKS = ["tool", "skill", "project", "prompt"];
const PRICING = ["free", "freemium", "paid", "api"];
const PLATFORMS = ["web", "app", "api", "cli"];
const allowedOrigins = new Set([
  `http://localhost:${SITE_PORT}`,
  `http://127.0.0.1:${SITE_PORT}`,
  ...(process.env.CURATOR_ALLOWED_ORIGIN || "").split(",").map((item) => item.trim()).filter(Boolean),
]);
const SITE_FILE = path.join(ROOT, "data/site.json");
const CURATOR_DIR = path.join(ROOT, ".curator");
const CONTENT_DB_FILE = path.resolve(process.env.CURATOR_CONTENT_DB || path.join(CURATOR_DIR, "content.sqlite"));
const RUNS_DIR = path.join(CURATOR_DIR, "runs");
const RUNS_INDEX_FILE = path.join(RUNS_DIR, "index.json");
const ACTIVITY_FILE = path.join(CURATOR_DIR, "activity.json");
const RUN_KEEP_COUNT = 30;
const RUN_KEEP_DAYS = 14;
const ACTIVITY_KEEP = 120;
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
const HOME = process.env.HOME || os.homedir();
// Some sites only filter on the UA string; a browser UA passes those. Sites
// with real bot detection (Cloudflare TLS fingerprinting) still 403, which the
// reprocess fallback handles.
const FETCH_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

let contentRepository;

async function contentStore() {
  if (contentRepository) return contentRepository;
  // Only bootstrap from the legacy JSON on a genuinely fresh install — once
  // the database exists it is the source of truth, and those JSON files may
  // no longer exist at all (tools.json is now an export target, and
  // resources.json is retired). Re-running the JSON import unconditionally
  // crashed every cold start of this server once resources.json was deleted.
  const dbExists = await fs.access(CONTENT_DB_FILE).then(() => true).catch(() => false);
  if (!dbExists) await importLegacyCatalog({ file: CONTENT_DB_FILE, dryRun: false });
  const contentDb = await openContentDb({ file: CONTENT_DB_FILE });
  contentRepository = createContentRepository(contentDb);
  return contentRepository;
}

async function exportPublicContent() {
  await exportContent({ outputRoot: ROOT, write: true });
}

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(JSON.stringify(payload));
}

function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return null;
  return allowedOrigins.has(origin) ? origin : false;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Error("请求不是有效 JSON");
  }
}

function isPrivateIp(address) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(normalized)) {
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
  }
  return true;
}

// Shape-only check: no DNS, so saving works offline. Used before writing JSON.
function assertUrlShape(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("请输入完整的 http 或 https 链接");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 http 和 https 链接");
  if (url.username || url.password) throw new Error("链接不能包含账号或密码");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("不能使用本机地址");
  }
  if ((net.isIP(host.replace(/^\[|\]$/g, "")) && isPrivateIp(host.replace(/^\[|\]$/g, "")))) {
    throw new Error("不能使用内网或保留地址");
  }
  return url;
}

function slugify(value) {
  // Keep CJK: a Chinese title should become a Chinese slug, not fall back to
  // a "new-resource" collision for every item.
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "new-resource";
}

function commandExists(bin) {
  const result = spawnSync("which", [bin], { encoding: "utf8" });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function addModel(models, id, label) {
  const value = String(id || "").trim();
  if (!value) return;
  if (models.some((item) => item.id === value)) return;
  models.push({ id: value, label: String(label || value).trim() || value });
}

function addCatalogModels(models, items) {
  for (const item of items || []) {
    if (item.visibility && item.visibility !== "list") continue;
    addModel(
      models,
      item.slug || item.model || item.id,
      item.display_name || item.displayName || item.slug || item.model,
    );
  }
}

function readCcSwitchCurrentCodexCatalog() {
  const result = spawnSync(
    "sqlite3",
    [
      path.join(HOME, ".cc-switch/cc-switch.db"),
      "SELECT json_extract(settings_config, '$.modelCatalog.models') FROM providers WHERE app_type = 'codex' AND is_current = 1 LIMIT 1",
    ],
    { encoding: "utf8", timeout: 2000 },
  );
  if (result.status !== 0) return [];
  const raw = result.stdout.trim();
  if (!raw || raw === "null") return [];
  try {
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function listCodexModels() {
  const models = [];
  let configText = "";
  try {
    configText = await fs.readFile(path.join(HOME, ".codex/config.toml"), "utf8");
    addModel(models, configText.match(/^model\s*=\s*"([^"]+)"/m)?.[1]);
  } catch {
    /* no local Codex config */
  }
  const providerCatalog = readCcSwitchCurrentCodexCatalog();
  if (providerCatalog.length) {
    addCatalogModels(models, providerCatalog);
    return models;
  }
  const catalogName = configText.match(/^\s*model_catalog_json\s*=\s*"([^"]+)"/m)?.[1];
  const catalogFile = catalogName
    ? path.join(HOME, ".codex", path.basename(catalogName))
    : path.join(HOME, ".codex/models_cache.json");
  addCatalogModels(models, (await readJsonFile(catalogFile))?.models);
  return models;
}

async function listClaudeModels() {
  const settings = await readJsonFile(path.join(HOME, ".claude/settings.json")) || {};
  const env = { ...process.env, ...(settings.env || {}) };
  const models = [];
  addModel(models, settings.model, settings.model);
  addModel(models, env.ANTHROPIC_MODEL, env.ANTHROPIC_MODEL);
  const aliases = [
    ["opus", env.ANTHROPIC_DEFAULT_OPUS_MODEL, env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME],
    ["sonnet", env.ANTHROPIC_DEFAULT_SONNET_MODEL, env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME],
    ["haiku", env.ANTHROPIC_DEFAULT_HAIKU_MODEL, env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME],
    ["fable", env.ANTHROPIC_DEFAULT_FABLE_MODEL, env.ANTHROPIC_DEFAULT_FABLE_MODEL_NAME],
  ];
  for (const [alias, resolved, name] of aliases) {
    addModel(models, alias, name ? `${alias} · ${name}` : alias);
    addModel(models, resolved, name || resolved);
  }
  const base = String(env.ANTHROPIC_BASE_URL || "").replace(/\/+$/, "");
  const key = env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY || "";
  if (base && key) {
    try {
      const response = await fetch(`${base}/v1/models`, {
        signal: AbortSignal.timeout(8000),
        headers: {
          "x-api-key": key,
          Authorization: `Bearer ${key}`,
          "anthropic-version": "2023-06-01",
        },
      });
      if (response.ok) {
        const payload = await response.json();
        const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
        for (const item of list) {
          const id = item.id || item.name || item.slug;
          addModel(models, id, item.display_name || item.name || id);
        }
      }
    } catch {
      /* local model directory is optional */
    }
  }
  return { models, defaultModel: settings.model || env.ANTHROPIC_MODEL || models[0]?.id || "" };
}

async function listAgents() {
  const [codexModels, claude] = await Promise.all([listCodexModels(), listClaudeModels()]);
  const tools = [
    {
      id: "codex",
      label: "Codex",
      available: commandExists(process.env.CURATOR_CODEX_BIN || "codex"),
      defaultModel: codexModels[0]?.id || "",
      models: codexModels,
    },
    {
      id: "claude",
      label: "Claude Code",
      available: commandExists(process.env.CURATOR_CLAUDE_BIN || "claude"),
      defaultModel: claude.defaultModel,
      models: claude.models,
    },
  ];
  return {
    tools,
    publicUrl: `http://localhost:${SITE_PORT}/zh/`,
  };
}

const SECRET_PATTERNS = [
  /\b(sk|rk|pk)-[A-Za-z0-9_-]{12,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\b[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\s*[=:]\s*\S+/g,
];

// Agent stdout/stderr is technical information, not product copy: strip
// credentials and local paths, drop ANSI noise, keep only the tail.
function sanitizeToolOutput(value, maxChars = 1200, maxLines = 30) {
  let text = String(value || "")
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\r/g, "");
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[已隐藏]");
  if (HOME) text = text.split(HOME).join("~");
  const lines = text.split("\n").filter((line) => line.trim()).slice(-maxLines);
  text = lines.join("\n").trim();
  return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
}

function runProcess({ command, args, prompt, parseOutput, onChild, onToolOutput, onAgentLog }) {
  return new Promise(async (resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], cwd: ROOT });
    onChild?.(child);
    let stdout = "";
    let stderr = "";
    let pendingOut = "";
    let pendingErr = "";
    // 按行清洗后实时转发 Agent 输出（ANSI/密钥脱敏沿用 sanitizeToolOutput）。
    const forward = (stream, text) => {
      if (!onAgentLog) return;
      const batch = text.split("\n").slice(0, -1).map((line) => line.trimEnd()).filter((line) => line.trim()).join("\n");
      if (batch) onAgentLog(sanitizeToolOutput(batch, 4000, 200), stream);
    };
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout = `${stdout}${text}`.slice(-20000);
      pendingOut += text;
      const newline = pendingOut.lastIndexOf("\n");
      if (newline >= 0) { forward("stdout", pendingOut.slice(0, newline + 1)); pendingOut = pendingOut.slice(newline + 1); }
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr = `${stderr}${text}`.slice(-8000);
      pendingErr += text;
      const newline = pendingErr.lastIndexOf("\n");
      if (newline >= 0) { forward("stderr", pendingErr.slice(0, newline + 1)); pendingErr = pendingErr.slice(newline + 1); }
    });
    if (prompt !== undefined) child.stdin.end(prompt);
    else child.stdin.end();
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", async (code) => {
      clearTimeout(timer);
      onToolOutput?.({
        command,
        exitCode: code,
        stdout: sanitizeToolOutput(stdout),
        stderr: sanitizeToolOutput(stderr),
      });
      try {
        if (code !== 0) throw new Error(stderr.trim() || stdout.trim() || `${command} exited with ${code}`);
        resolve(await parseOutput(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function runCodex(prompt, model, options = {}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-nav-curator-"));
  const outputPath = path.join(tempDir, "draft.json");
  const args = [
    "exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "workspace-write",
    "-c", "sandbox_workspace_write.network_access=true",
    "--color", "never", "-C", tempDir, "--output-schema", SCHEMA_PATH,
    "--output-last-message", outputPath, "-",
  ];
  if (model) args.splice(1, 0, "-m", model);
  try {
    return await runProcess({
      command: process.env.CURATOR_CODEX_BIN || "codex",
      args,
      prompt,
      parseOutput: async () => JSON.parse(await fs.readFile(outputPath, "utf8")),
      onChild: options.onChild,
      onToolOutput: options.onToolOutput,
      onAgentLog: options.onAgentLog,
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function parseClaudeDraft(stdout) {
  const text = String(stdout || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude 没有返回 JSON");
  const payload = JSON.parse(text.slice(start, end + 1));
  const result = payload.result ?? payload.structured_output ?? payload;
  if (typeof result === "string") {
    const match = result.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Claude 没有返回 JSON");
    return JSON.parse(match[0]);
  }
  if (result && typeof result === "object" && (result.name || result.slug || result.verdict)) return result;
  throw new Error("Claude 没有返回结构化结果");
}

async function runClaude(prompt, model, options = {}) {
  const args = [
    "--print", "--output-format", "json", "--json-schema", SCHEMA_PATH,
    "--dangerously-skip-permissions",
    "--disallowedTools", "Bash,Edit,Write,WebSearch,Agent,NotebookEdit",
  ];
  if (model) args.push("--model", model);
  args.push(prompt);
  return runProcess({
    command: process.env.CURATOR_CLAUDE_BIN || "claude",
    args,
    parseOutput: (stdout) => parseClaudeDraft(stdout),
    onChild: options.onChild,
    onToolOutput: options.onToolOutput,
    onAgentLog: options.onAgentLog,
  });
}

async function existingResources() {
  const repository = await contentStore();
  return repository.list().map(asLegacyCatalogItem);
}

// Turn raw CLI failures into a reason the operator can act on: usage limits,
// login state, missing binary, or the first ERROR line of the log.
function describeAgentFailure(message, toolLabel) {
  const text = String(message || "");
  const reset = text.match(/try again at (\d{1,2}:\d{2}\s*[AP]M)/i);
  if (/usage limit|hit your usage/i.test(text)) return `${toolLabel} 额度已用尽${reset ? `，${reset[1]} 后重置` : ""}`;
  if (/not logged in|unauthorized|invalid api key/i.test(text)) return `${toolLabel} 未登录或凭证失效`;
  if (/ENOENT|command not found/i.test(text)) return `${toolLabel} 命令不存在或不在 PATH`;
  const firstError = text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^\d{4}-\d{2}-\d{2}T/.test(line) && !/codex_models_manager/.test(line))
    .find((line) => /^error/i.test(line));
  return firstError ? firstError.slice(0, 140) : `${toolLabel} 没有返回结构化结果`;
}

function loadSkill() {
  try {
    return readFileSync(SKILL_PATH, "utf8");
  } catch {
    return "访问任务给定的 URL，提取名称、简介、定价、平台与图标，按 schema 输出 JSON。";
  }
}

function buildAgentPrompt(url, note, catalog, targetBlock, existingContent = "") {
  const blockNote = INGEST_BLOCKS.includes(targetBlock)
    ? `目标板块已指定为 ${targetBlock}，不要更改。`
    : "目标板块未指定：由你根据内容判断（tool / skill / project / prompt）。";
  return `${loadSkill()}

---- 本次任务 ----
整理这条资源：${url}
${blockNote}
整理备注：${String(note || "无").slice(0, 1000)}

当前目录（用于查重与避免重复收录；仅参考，不要照抄其中的文案）：
${catalog || "（空）"}${existingContent ? `
这条内容正在被重新处理，现状如下（找出遗漏并改写，不要照抄其中的错误）：
${existingContent.slice(0, 12000)}` : ""}

按 SKILL 规则完成整理，最终只输出一个符合 schema 的 JSON 对象。`;
}

async function agentDraft(url, note, tool, model, targetBlock = "tool", options = {}) {
  const prompt = buildAgentPrompt(url, note, options.catalog || "", targetBlock, options.existingContent);
  const selected = tool === "claude" ? "claude" : "codex";
  try {
    const draft = selected === "claude"
      ? await runClaude(prompt, model, options)
      : await runCodex(prompt, model, options);
    return { draft, agent: { mode: selected, tool: selected, model } };
  } catch (error) {
    const toolLabel = selected === "claude" ? "Claude Code" : "Codex";
    throw new Error(describeAgentFailure(error instanceof Error ? error.message : "", toolLabel));
  }
}

let activityQueue = Promise.resolve();

async function readActivity() {
  try {
    const data = JSON.parse(await fs.readFile(ACTIVITY_FILE, "utf8"));
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function recordActivity(entry) {
  activityQueue = activityQueue.then(async () => {
    const items = await readActivity();
    items.unshift({ at: new Date().toISOString(), ...entry });
    await fs.mkdir(CURATOR_DIR, { recursive: true });
    await writeJsonAtomic(ACTIVITY_FILE, { items: items.slice(0, ACTIVITY_KEEP) });
  }).catch(() => undefined);
  return activityQueue;
}

const runs = new Map();

function publicRun(run) {
  return {
    id: run.id,
    status: run.status,
    phase: run.phase,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    input: {
      url: run.input?.url || "",
      note: run.input?.note || "",
      ...(run.input?.block ? { block: run.input.block } : {}),
      ...(run.input?.mode ? { mode: run.input.mode } : {}),
      ...(run.input?.contentId ? { contentId: run.input.contentId } : {}),
      ...(run.input?.tool ? { tool: run.input.tool } : {}),
      ...(run.input?.model ? { model: run.input.model } : {}),
    },
    ...(run.draft ? { draft: run.draft } : {}),
    ...(run.source ? { source: run.source } : {}),
    ...(run.agent ? { agent: run.agent } : {}),
    ...(run.candidateId ? { candidateId: run.candidateId } : {}),
    ...(run.error ? { error: run.error } : {}),
    eventCount: run.events.length || run.restoredEventCount || 0,
  };
}

function runIsTerminal(run) {
  return ["awaiting_review", "saved", "failed", "cancelled"].includes(run.status);
}

let runIndexQueue = Promise.resolve();

function persistRuns() {
  runIndexQueue = runIndexQueue.then(async () => {
    const items = [...runs.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RUN_KEEP_COUNT)
      .map((run) => publicRun(run));
    await fs.mkdir(RUNS_DIR, { recursive: true });
    await writeJsonAtomic(RUNS_INDEX_FILE, { items });
  }).catch(() => undefined);
  return runIndexQueue;
}

async function runRecordStats() {
  try {
    const files = (await fs.readdir(RUNS_DIR)).filter((name) => name.endsWith(".jsonl"));
    let bytes = 0;
    let oldest = "";
    for (const name of files) {
      const info = await fs.stat(path.join(RUNS_DIR, name)).catch(() => null);
      if (!info) continue;
      bytes += info.size;
      const at = info.mtime.toISOString();
      if (!oldest || at < oldest) oldest = at;
    }
    return { count: files.length, bytes, oldest };
  } catch {
    return { count: 0, bytes: 0, oldest: "" };
  }
}

async function clearRunRecords() {
  runs.clear();
  const files = await fs.readdir(RUNS_DIR).catch(() => []);
  for (const name of files) {
    if (name.endsWith(".jsonl") || name === "index.json") {
      await fs.rm(path.join(RUNS_DIR, name), { force: true }).catch(() => undefined);
    }
  }
  return runRecordStats();
}

async function readStoredRunEvents(id) {
  try {
    const raw = await fs.readFile(path.join(RUNS_DIR, `${id}.jsonl`), "utf8");
    return raw.split("\n").filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

async function restoreRuns() {
  const cutoff = Date.now() - RUN_KEEP_DAYS * 24 * 60 * 60 * 1000;
  let stored = [];
  try {
    const data = JSON.parse(await fs.readFile(RUNS_INDEX_FILE, "utf8"));
    stored = Array.isArray(data.items) ? data.items : [];
  } catch {
    stored = [];
  }
  const kept = stored
    .filter((item) => item.id && Date.parse(item.updatedAt || item.createdAt || "") >= cutoff)
    .slice(0, RUN_KEEP_COUNT);
  for (const item of kept) {
    const interrupted = !["awaiting_review", "saved", "failed", "cancelled"].includes(item.status);
    runs.set(item.id, {
      id: item.id,
      status: interrupted ? "failed" : item.status,
      phase: item.phase || "fetch",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      draft: item.draft,
      source: item.source,
      agent: item.agent,
      error: interrupted ? "服务重启，这次分析没有完成" : item.error,
      input: {
        url: item.input?.url || item.draft?.url || "",
        note: item.input?.note || "",
        block: INGEST_BLOCKS.includes(item.input?.block) ? item.input.block : "tool",
        ...(item.input?.mode ? { mode: item.input.mode } : {}),
        ...(item.input?.contentId ? { contentId: item.input.contentId } : {}),
        tool: item.input?.tool === "claude" ? "claude" : "codex",
        model: item.input?.model || "",
      },
      events: [],
      restoredEventCount: item.eventCount || 0,
      subscribers: new Set(),
      child: null,
    });
  }
  const keepIds = new Set(kept.map((item) => item.id));
  const files = await fs.readdir(RUNS_DIR).catch(() => []);
  for (const name of files) {
    if (!name.endsWith(".jsonl")) continue;
    if (keepIds.has(name.replace(/\.jsonl$/, ""))) continue;
    await fs.rm(path.join(RUNS_DIR, name), { force: true }).catch(() => undefined);
  }
  if (kept.length !== stored.length) await persistRuns();
}

function writeRunEvent(run, event) {
  fs.mkdir(RUNS_DIR, { recursive: true })
    .then(() => fs.appendFile(path.join(RUNS_DIR, `${run.id}.jsonl`), `${JSON.stringify(event)}\n`, "utf8"))
    .catch(() => undefined);
}

function emitRunEvent(run, phase, type, level, message, data) {
  run.phase = phase;
  run.updatedAt = new Date().toISOString();
  const event = {
    runId: run.id,
    sequence: run.events.length + 1,
    timestamp: run.updatedAt,
    phase,
    type,
    level,
    message,
    ...(data ? { data } : {}),
  };
  run.events.push(event);
  writeRunEvent(run, event);
  const payload = `id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const response of run.subscribers) response.write(payload);
  if (runIsTerminal(run)) {
    for (const response of run.subscribers) response.end();
    run.subscribers.clear();
    persistRuns();
  }
  return event;
}

function throwIfCancelled(run) {
  if (run.status === "cancelled") throw Object.assign(new Error("分析已取消"), { cancelled: true });
}

function similarResources(draft, catalog) {
  let host = null;
  try { host = new URL(draft.url).hostname.replace(/^www\./, ""); } catch {}
  const name = String(draft.name || "").toLowerCase();
  return catalog.filter((item) => {
    let itemHost = null;
    try { itemHost = new URL(item.url).hostname.replace(/^www\./, ""); } catch {}
    return (host && itemHost === host) || (name && item.name.toLowerCase() === name);
  }).slice(0, 5);
}

async function executeRun(run) {
  run.status = "running";
  try {
    let existingContent = "";
    if (run.input.mode === "reprocess") {
      const repository = await contentStore();
      const reprocessTarget = repository.get(run.input.contentId);
      if (!reprocessTarget) throw new Error("找不到要重新处理的内容");
      run.input.block = INGEST_BLOCKS.includes(reprocessTarget.blockType) ? reprocessTarget.blockType : "tool";
      run.input.url = run.input.url || reprocessTarget.sourceUrl || reprocessTarget.payload?.url || "";
      if (!run.input.url) throw new Error("这条内容没有来源链接，无法重新处理");
      existingContent = JSON.stringify({ title: reprocessTarget.title, payload: reprocessTarget.payload }, null, 2);
    }

    emitRunEvent(run, "run", "phase.started", "info", "Agent 正在整理", {
      tool: run.input.tool,
      model: run.input.model,
    });
    const catalogText = (await existingResources())
      .map((item) => `${item.slug} | ${item.name} | ${item.kind || "tool"}`)
      .join("\n");
    const result = await agentDraft(run.input.url, run.input.note, run.input.tool, run.input.model, run.input.block, {
      catalog: catalogText,
      existingContent,
      onChild: (child) => { run.child = child; },
      onAgentLog: (text, stream) => emitRunEvent(run, "run", "agent.log", "info", text, { stream }),
      onToolOutput: (payload) => {
        if (!payload.stdout && !payload.stderr) return;
        const toolLabel = payload.command === "claude" ? "Claude Code" : "Codex";
        emitRunEvent(run, "run", "tool.output", "info", describeAgentFailure(payload.stderr || payload.stdout || "", toolLabel), payload);
      },
    });
    run.child = null;
    throwIfCancelled(run);
    run.agent = result.agent;

    const finalUrl = assertUrlShape(result.draft.url || run.input.url).toString();
    run.input.url = finalUrl;
    run.draft = normalizeDraft(result.draft, finalUrl);
    emitRunEvent(run, "run", "draft.patch", "success", "草稿已生成", { draft: run.draft });

    const catalog = await existingResources();
    const similar = similarResources(run.draft, catalog);
    if (similar.length) {
      emitRunEvent(run, "run", "warning.added", "warning", `目录里已有同域或同名的资源：${similar.slice(0, 3).map((item) => item.name).join("、")}${similar.length > 3 ? " 等" : ""}，确认不是重复再保存`, {
        items: similar.map((item) => ({ slug: item.slug, name: item.name, url: item.url })),
      });
    }

    validateResourceFields(run.draft);

    if (run.draft.sourceLogoUrl) {
      const local = await freezeLogo(run.draft.slug, run.draft.sourceLogoUrl, finalUrl).catch(() => undefined);
      if (local) {
        run.draft.sourceLogoUrl = local;
        emitRunEvent(run, "run", "evidence.added", "success", `Logo 已固化：${local}`);
      } else {
        emitRunEvent(run, "run", "warning.added", "warning", "Logo 下载失败，保存前可手动指定");
      }
    } else {
      emitRunEvent(run, "run", "warning.added", "warning", "未找到 Logo，保存前可手动指定");
    }

    run.status = "awaiting_review";
    emitRunEvent(run, "complete", "run.completed", "success", run.input.mode === "reprocess" ? "新版草稿已生成，请预览采用" : "整理完成，等待确认", {
      draft: run.draft,
      agent: run.agent,
      durationMs: Date.now() - new Date(run.createdAt).getTime(),
    });
  } catch (error) {
    run.child = null;
    if (run.status === "cancelled" || error?.cancelled) return;
    run.status = "failed";
    run.error = error instanceof Error ? error.message : "整理失败";
    emitRunEvent(run, run.phase || "run", "run.failed", "error", run.error);
  }
}

function createRun(input) {
  const now = new Date().toISOString();
  const run = {
    id: randomUUID(),
    status: "queued",
    phase: "prepare",
    createdAt: now,
    updatedAt: now,
    input: {
      url: String(input.url || "").trim(),
      note: cleanText(input.note, 1000),
      block: input.block === "auto" ? "auto" : INGEST_BLOCKS.includes(input.block) ? input.block : "auto",
      ...(input.mode === "reprocess" ? { mode: "reprocess" } : { mode: "ingest" }),
      ...(input.contentId ? { contentId: String(input.contentId) } : {}),
      tool: input.tool === "claude" ? "claude" : "codex",
      model: cleanText(input.model, 80),
      ...(input.seed ? { seed: input.seed } : {}),
    },
    events: [],
    subscribers: new Set(),
    child: null,
  };
  runs.set(run.id, run);
  persistRuns();
  emitRunEvent(run, "prepare", "phase.progress", "info", "任务已创建");
  setTimeout(() => executeRun(run), 0);
  return run;
}

function cancelRun(run) {
  if (runIsTerminal(run)) return run;
  run.status = "cancelled";
  run.child?.kill("SIGTERM");
  run.child = null;
  emitRunEvent(run, run.phase, "run.cancelled", "warning", "分析已取消");
  return run;
}

let buildJob = { status: "idle", log: "", error: "", publicUrl: `http://localhost:${SITE_PORT}/zh/` };

function appendBuildLog(chunk) {
  buildJob.log = `${buildJob.log}${chunk}`.slice(-8000);
}

async function touchBuildSources() {
  const now = new Date();
  await Promise.all([
    "lib/data.ts",
    "lib/public-content.ts",
    "data/tools.json",
    "data/site.json",
  ].map((file) => fs.utimes(path.join(ROOT, file), now, now).catch(() => undefined)));
}

function startBuildCheck() {
  if (buildJob.status === "running") {
    throw Object.assign(new Error("已有构建在进行"), { statusCode: 409 });
  }
  buildJob = {
    status: "running",
    log: "",
    error: "",
    publicUrl: `http://localhost:${SITE_PORT}/zh/`,
  };
  const child = spawn(process.execPath, [NEXT_BIN, "build"], {
    cwd: ROOT,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => appendBuildLog(chunk.toString()));
  child.stderr.on("data", (chunk) => appendBuildLog(chunk.toString()));
  child.on("error", (error) => {
    buildJob.status = "error";
    buildJob.error = error.message;
  });
  child.on("exit", async (code) => {
    if (code === 0) {
      await touchBuildSources();
      buildJob.status = "ok";
    } else {
      buildJob.status = "error";
      buildJob.error = buildJob.log.trim().slice(-400) || `构建失败（${code}）`;
    }
  });
  touchBuildSources().catch(() => undefined);
  return buildJob;
}

function cleanText(value, max = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function usableLogoUrl(value) {
  const url = cleanText(value, 1000);
  if (!url || url.startsWith("data:")) return undefined;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function extensionForLogo(contentType, url) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (LOGO_TYPES[type]) return LOGO_TYPES[type];
  try {
    const ext = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    if (["png", "svg", "jpg", "jpeg", "webp", "gif", "ico"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  } catch {
    return "";
  }
  return "";
}

const HOST_OVERRIDE = {
  chatgpt: "chatgpt.com",
  "github-copilot": "github.com",
  codex: "openai.com",
  veo: "deepmind.google",
  "openai-skills": "openai.com",
  "taste-skill": "github.com",
};

function hostOfUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function logoCandidateUrls(slug, targetUrl, sourceLogoUrl) {
  const urls = [];
  if (sourceLogoUrl && usableLogoUrl(sourceLogoUrl)) {
    urls.push(sourceLogoUrl);
  }
  const host = HOST_OVERRIDE[slug] || hostOfUrl(targetUrl);
  if (host) {
    if (host === "github.com") {
      try {
        const [, owner] = new URL(targetUrl).pathname.split("/");
        if (owner) urls.push(`https://github.com/${owner}.png`);
      } catch {}
    }
    urls.push(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`,
      `https://${host}/favicon.ico`,
    );
  }
  return [...new Set(urls.filter(Boolean))];
}

async function downloadLogo(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": FETCH_UA,
    },
  });
  if (!response.ok) return null;
  const type = response.headers.get("content-type") || "";
  if (type.includes("text/html")) return null;
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length < 32 || buf.length > MAX_LOGO_BYTES) return null;
  return { buf, type };
}

async function freezeLogo(slug, sourceLogoUrl, targetUrl) {
  const dir = path.join(ROOT, "public/logos");
  await fs.mkdir(dir, { recursive: true });

  const urls = logoCandidateUrls(slug, targetUrl, sourceLogoUrl);
  for (const url of urls) {
    try {
      const got = await downloadLogo(url);
      if (!got) continue;
      const ext = extensionForLogo(got.type, url) || "png";
      const filename = `${slug}.${ext}`;
      await fs.writeFile(path.join(dir, filename), got.buf);
      return `/logos/${filename}`;
    } catch {
      continue;
    }
  }
  return undefined;
}

function normalizeDraft(input = {}, finalUrl) {
  const inferredBlock = input.blockType || (input.kind === "open-source" ? "project" : input.kind);
  const blockType = INGEST_BLOCKS.includes(inferredBlock) ? inferredBlock : "tool";
  let fallbackName = "新资源";
  try { fallbackName = new URL(finalUrl).hostname.replace(/^www\./, ""); } catch {}
  const name = cleanText(input.name || fallbackName, 80);
  const kind = blockType === "project" ? "open-source" : blockType;
  const pricing = PRICING.includes(input.pricing) ? input.pricing : "freemium";
  const platforms = Array.isArray(input.platforms)
    ? [...new Set(input.platforms.filter((item) => PLATFORMS.includes(item)))]
    : [];
  const links = Array.isArray(input.links)
    ? input.links.map((link) => ({
        label: cleanText(link?.label, 80),
        url: usableLogoUrl(link?.url) || cleanText(link?.url, 2000),
        ...(link?.kind ? { kind: cleanText(link.kind, 24) } : {}),
      })).filter((link) => link.label && link.url)
    : [];
  return {
    name,
    slug: slugify(input.slug || name),
    url: finalUrl,
    kind,
    blockType,
    pricing,
    platforms,
    verdict: {
      en: cleanText(input.verdict?.en, 72),
      zh: cleanText(input.verdict?.zh, 36),
    },
    summary: {
      en: cleanText(input.summary?.en, 140),
      zh: cleanText(input.summary?.zh, 72),
    },
    confidence: Math.max(0, Math.min(1, Number(input.confidence) || 0)),
    rationale: cleanText(input.rationale, 280),
    sourceLogoUrl: usableLogoUrl(input.logoUrl),
    body: typeof input.body === "string" ? input.body.trim().slice(0, 24000) : "",
    links,
    prompt: typeof input.prompt === "string" ? input.prompt.trim().slice(0, 16000) : "",
    variables: Array.isArray(input.variables)
      ? input.variables.map((item) => ({
          name: cleanText(item?.name, 80),
          description: cleanText(item?.description, 500),
          ...(item?.example ? { example: cleanText(item.example, 1000) } : {}),
        })).filter((item) => item.name && item.description)
      : [],
    examples: Array.isArray(input.examples)
      ? input.examples.map((item) => ({
          input: String(item?.input || "").trim().slice(0, 4000),
          output: String(item?.output || "").trim().slice(0, 8000),
        })).filter((item) => item.input && item.output)
      : [],
  };
}

async function writeJsonAtomic(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(temp, file);
}

function shanghaiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function contentKindToLegacy(blockType) {
  if (blockType === "skill") return "skill";
  if (blockType === "project") return "open-source";
  return "tool";
}

function linksForPayload(payload) {
  return Array.isArray(payload?.links) ? payload.links : [];
}

function asLegacyCatalogItem(item) {
  const payload = item.payload || {};
  const primaryLink = linksForPayload(payload).find((link) => link.kind === "official") || linksForPayload(payload)[0];
  const url = String(payload.url || primaryLink?.url || item.sourceUrl || "");
  return {
    id: item.id,
    slug: item.slug,
    name: item.title,
    url,
    ...(payload.logo ? { logo: payload.logo } : {}),
    kind: contentKindToLegacy(item.blockType),
    pricing: payload.pricing || "free",
    platforms: Array.isArray(payload.platforms) ? payload.platforms : [],
    // Legacy clients only understand active/archived. Keep the richer state
    // alongside it until the board-specific editors land.
    status: item.status === "archived" ? "archived" : "active",
    contentStatus: item.status,
    verdict: payload.tagline || { en: "", zh: "" },
    summary: payload.summary || { en: "", zh: "" },
  };
}

async function bumpSite() {
  const site = JSON.parse(await fs.readFile(SITE_FILE, "utf8"));
  site.updatedAt = shanghaiDate();
  await writeJsonAtomic(SITE_FILE, site);
  return site;
}

function validateResourceFields(item) {
  if (!item?.name || !item.verdict?.en || !item.verdict?.zh || !item.summary?.en || !item.summary?.zh) {
    throw new Error("名称和中英双语文案不能为空");
  }
  if (!KINDS.includes(item.kind || "tool")) throw new Error("未知资源类型");
}

function draftBlockType(draft) {
  if (INGEST_BLOCKS.includes(draft?.blockType)) return draft.blockType;
  if (draft?.kind === "skill") return "skill";
  if (draft?.kind === "open-source") return "project";
  if (draft?.kind === "prompt") return "prompt";
  return "tool";
}

function contentPayloadFromDraft(draft, currentPayload = {}) {
  const blockType = draftBlockType(draft);
  const links = Array.isArray(draft.links) && draft.links.length ? draft.links : currentPayload.links || [];
  if (blockType === "tool") {
    return {
      ...currentPayload,
      ...(draft.sourceLogoUrl?.startsWith("/logos/") ? { logo: draft.sourceLogoUrl } : {}),
      tagline: draft.verdict,
      summary: draft.summary,
      url: draft.url,
      pricing: draft.pricing,
      platforms: draft.platforms,
    };
  }
  if (blockType === "prompt") {
    return {
      ...currentPayload,
      summary: draft.summary,
      prompt: String(draft.prompt || currentPayload.prompt || "").trim(),
      variables: Array.isArray(draft.variables) ? draft.variables : currentPayload.variables || [],
      examples: Array.isArray(draft.examples) ? draft.examples : currentPayload.examples || [],
      links,
    };
  }
  return {
    ...currentPayload,
    summary: draft.summary,
    body: String(draft.body || currentPayload.body || "").trim(),
    links,
  };
}

async function saveCandidate(run, draft) {
  const repository = await contentStore();
  const current = repository.get(run.input.contentId);
  if (!current) throw Object.assign(new Error("找不到要重新处理的内容"), { statusCode: 404 });
  const payload = contentPayloadFromDraft(draft, current.payload);
  const candidate = repository.createCandidate(current.id, payload, {
    note: "Agent 重新处理候选版本",
    createdBy: run.input.tool || "agent",
  });
  run.candidateId = candidate.id;
  return {
    target: "candidate",
    destination: "candidate",
    slug: current.slug,
    candidateId: candidate.id,
    message: "AI 已生成候选版本，确认后再应用到公开内容。",
    publicUrl: `http://localhost:${SITE_PORT}/zh/`,
  };
}

let writeQueue = Promise.resolve();
async function saveDraft(rawDraft) {
  const repository = await contentStore();
  return writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const finalUrl = (await assertPublicUrl(rawDraft.url)).toString();
    const draft = normalizeDraft(rawDraft, finalUrl);
    const existing = await existingResources();
    if (existing.some((item) => item.id === draft.slug || item.slug === draft.slug || item.url === finalUrl)) {
      throw Object.assign(new Error("这条资源已经存在，请不要重复保存"), { statusCode: 409 });
    }
    const blockType = INGEST_BLOCKS.includes(draft.blockType)
      ? draft.blockType
      : draft.kind === "skill" ? "skill" : draft.kind === "open-source" ? "project" : draft.kind === "prompt" ? "prompt" : "tool";
    const logo = (await freezeLogo(draft.slug, draft.sourceLogoUrl, finalUrl))
      || (draft.sourceLogoUrl?.startsWith("/logos/") ? draft.sourceLogoUrl : undefined);
    const links = Array.isArray(draft.links) && draft.links.length
      ? draft.links
      : [{ label: "Official link", url: finalUrl, kind: "official" }];
    const payload = blockType === "tool"
      ? {
          ...(logo ? { logo } : {}),
          tagline: draft.verdict,
          summary: draft.summary,
          url: finalUrl,
          pricing: draft.pricing,
          platforms: draft.platforms,
        }
      : blockType === "prompt"
        ? {
          summary: draft.summary,
          prompt: String(draft.prompt || "").trim(),
          variables: Array.isArray(draft.variables) ? draft.variables : [],
          examples: Array.isArray(draft.examples) ? draft.examples : [],
          links,
        }
        : {
          summary: draft.summary,
          body: String(draft.body || ""),
          links,
        };
    const at = new Date().toISOString();
    const item = {
      id: draft.slug,
      blockType,
      slug: draft.slug,
      title: draft.name,
      status: blockType === "tool" ? "active" : "draft",
      tags: [],
      sourceUrl: finalUrl,
      createdAt: at,
      updatedAt: at,
      payload,
    };
    const saved = repository.save(item, { revisionKind: "manual", note: "从收录草稿保存" });
    await bumpSite();
    await exportPublicContent();
    recordActivity({
      type: "resource.created",
      slug: saved.slug,
      name: saved.title,
      message: `收录资源「${saved.title}」`,
    });
    return {
      target: `content/${blockType}`,
      destination: "catalog",
      slug: saved.slug,
      message: blockType === "tool" ? "已保存到工具目录，刷新公开站即可看到。" : "已保存为待编辑草稿，请补正文后发布。",
      publicUrl: `http://localhost:${SITE_PORT}/zh/`,
    };
  });
}

const CONTENT_BLOCKS = ["tool", "skill", "project", "prompt", "course", "article"];

function assertContentItemShape(item) {
  if (!item || typeof item !== "object") throw new Error("内容必须是对象");
  if (!CONTENT_BLOCKS.includes(item.blockType)) throw new Error("未知内容板块");
  if (!String(item.id || item.slug || "").trim()) throw new Error("内容缺少 id 或 slug");
  if (!String(item.title || "").trim()) throw new Error("标题不能为空");
  if (!item.payload || typeof item.payload !== "object") throw new Error("内容 payload 无效");
}

function validateContentPayload(item) {
  if (item.status !== "active") return;
  if (["skill", "project", "course", "article"].includes(item.blockType) && !String(item.payload.body || "").trim()) {
    throw new Error("已发布的长文必须填写正文");
  }
  if (item.blockType === "prompt" && !String(item.payload.prompt || "").trim()) {
    throw new Error("已发布的提示词必须填写正文");
  }
}

function contentIssueCount(item) {
  const payload = item.payload || {};
  let count = 0;
  if (!String(item.title || "").trim()) count += 1;
  if (!String(item.slug || "").trim()) count += 1;
  if (!String(payload.summary?.zh || "").trim() || !String(payload.summary?.en || "").trim()) count += 1;
  if (item.blockType === "tool" && (!String(payload.url || "").trim() || !String(payload.tagline?.zh || "").trim() || !String(payload.tagline?.en || "").trim())) count += 1;
  if (["skill", "project"].includes(item.blockType) && !String(payload.body || "").trim()) count += 1;
  if (item.blockType === "prompt" && !String(payload.prompt || "").trim()) count += 1;
  return count;
}

async function listContentPage(searchParams) {
  const repository = await contentStore();
  const block = searchParams.get("block") || "all";
  const status = searchParams.get("status") || "all";
  const query = String(searchParams.get("query") || "").trim().toLowerCase();
  const issuesOnly = searchParams.get("issues") === "true";
  const sort = searchParams.get("sort") || "updated-desc";
  const pageSize = [20, 50].includes(Number(searchParams.get("pageSize"))) ? Number(searchParams.get("pageSize")) : 20;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  if (block !== "all" && !INGEST_BLOCKS.includes(block)) throw new Error("未知内容板块");
  if (status !== "all" && !["draft", "active", "archived"].includes(status)) throw new Error("未知内容状态");
  // Unfiltered stats so the dashboard never has to count a single page of
  // results and get the wrong total.
  const every = repository.list();
  const withIssuesAll = every.map((item) => ({ ...item, issueCount: contentIssueCount(item) }));
  const counts = {
    all: every.length,
    tool: every.filter((item) => item.blockType === "tool").length,
    skill: every.filter((item) => item.blockType === "skill").length,
    project: every.filter((item) => item.blockType === "project").length,
    prompt: every.filter((item) => item.blockType === "prompt").length,
    active: every.filter((item) => item.status === "active").length,
    archived: every.filter((item) => item.status === "archived").length,
    draft: every.filter((item) => item.status === "draft").length,
    issues: withIssuesAll.filter((item) => item.issueCount > 0).length,
    issueTotal: withIssuesAll.reduce((total, item) => total + item.issueCount, 0),
    blocks: Object.fromEntries(INGEST_BLOCKS.map((block) => {
      const inBlock = every.filter((item) => item.blockType === block);
      return [block, {
        total: inBlock.length,
        active: inBlock.filter((item) => item.status === "active").length,
        draft: inBlock.filter((item) => item.status === "draft").length,
      }];
    })),
  };
  let items = every;
  if (block !== "all") items = items.filter((item) => item.blockType === block);
  if (status !== "all") items = items.filter((item) => item.status === status);
  if (query) items = items.filter((item) => `${item.title} ${item.slug} ${item.sourceUrl || ""} ${item.payload?.summary?.zh || ""} ${item.payload?.summary?.en || ""}`.toLowerCase().includes(query));
  const withIssues = items.map((item) => ({ ...item, issueCount: contentIssueCount(item) }));
  items = issuesOnly ? withIssues.filter((item) => item.issueCount > 0) : withIssues;
  items.sort((a, b) => sort === "title-asc" ? a.title.localeCompare(b.title) : sort === "updated-asc" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  return { items: items.slice((currentPage - 1) * pageSize, currentPage * pageSize), total, page: currentPage, pageSize, pages, counts };
}

async function updateContentBatch(ids, status) {
  if (!["active", "archived"].includes(status)) throw new Error("批量操作只支持发布或归档");
  const repository = await contentStore();
  const updated = [];
  for (const id of [...new Set((ids || []).map(String))]) {
    const current = repository.get(id);
    if (!current) continue;
    validateContentPayload({ ...current, status });
    updated.push(repository.save({ ...current, status }, { expectedRevisionId: current.revision?.id, note: status === "active" ? "批量发布" : "批量归档" }));
  }
  await bumpSite();
  await exportPublicContent();
  return { updated: updated.length, message: `已${status === "active" ? "发布" : "归档"} ${updated.length} 条内容` };
}

async function saveContentItem(raw, expectedRevisionId) {
  const repository = await contentStore();
  assertContentItemShape(raw);
  validateContentPayload(raw);
  const current = repository.get(raw.id || raw.slug);
  const bySlug = repository.get(raw.slug);
  if (bySlug && (!current || bySlug.id !== current.id)) {
    throw Object.assign(new Error("slug 已被其他内容占用"), { statusCode: 409 });
  }
  const next = {
    ...raw,
    id: current?.id || String(raw.id || raw.slug),
    slug: slugify(raw.slug || raw.title),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    status: ["draft", "active", "archived"].includes(raw.status) ? raw.status : "draft",
    sourceUrl: raw.sourceUrl ? String(raw.sourceUrl) : undefined,
  };
  const saved = repository.save(next, {
    expectedRevisionId: expectedRevisionId ?? current?.revision?.id,
    note: "保存板块内容",
  });
  await bumpSite();
  await exportPublicContent();
  recordActivity({
    type: current ? "resource.saved" : "resource.created",
    slug: saved.slug,
    name: saved.title,
    message: `${current ? "保存" : "新建"}「${saved.title}」`,
  });
  return saved;
}

async function listCandidates(itemId) {
  const repository = await contentStore();
  const item = repository.get(itemId);
  if (!item) throw Object.assign(new Error("找不到对应内容"), { statusCode: 404 });
  return { item, candidates: repository.candidates(item.id) };
}

async function applyCandidate(itemId, revisionId) {
  const repository = await contentStore();
  const item = repository.applyCandidate(itemId, revisionId);
  await bumpSite();
  await exportPublicContent();
  recordActivity({
    type: "resource.saved",
    slug: item.slug,
    name: item.title,
    message: `应用 AI 候选版本「${item.title}」`,
  });
  return item;
}

async function abandonCandidate(itemId, revisionId) {
  const repository = await contentStore();
  repository.abandonCandidate(itemId, revisionId);
  return { message: "候选版本已放弃。" };
}

const server = http.createServer(async (request, response) => {
  const origin = allowedOrigin(request);
  if (origin === false) return sendJson(response, 403, { error: "当前页面来源不允许访问本地整理服务" });
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    });
    return response.end();
  }
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
    if (request.method === "GET" && url.pathname === "/health") {
      const agents = await listAgents();
      return sendJson(response, 200, { ok: true, ...agents, build: buildJob }, origin);
    }
    if (request.method === "GET" && url.pathname === "/agents") {
      return sendJson(response, 200, await listAgents(), origin);
    }
    if (request.method === "GET" && url.pathname === "/build") {
      return sendJson(response, 200, buildJob, origin);
    }
    if (request.method === "POST" && url.pathname === "/build") {
      return sendJson(response, 200, startBuildCheck(), origin);
    }
    if (request.method === "GET" && url.pathname === "/runs") {
      const items = [...runs.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30)
        .map(publicRun);
      return sendJson(response, 200, { items }, origin);
    }
    if (request.method === "POST" && url.pathname === "/runs") {
      const body = await readJson(request);
      if (!String(body.url || "").trim()) throw new Error("请输入资源链接");
      const run = createRun(body);
      return sendJson(response, 202, publicRun(run), origin);
    }
    if (request.method === "GET" && url.pathname === "/runs/records") {
      return sendJson(response, 200, await runRecordStats(), origin);
    }
    if (request.method === "DELETE" && url.pathname === "/runs/records") {
      const stats = await clearRunRecords();
      return sendJson(response, 200, { ...stats, message: "已清除本地运行记录" }, origin);
    }
    if (request.method === "GET" && url.pathname === "/activity") {
      const items = await readActivity();
      const limit = Math.min(Number(url.searchParams.get("limit")) || 30, ACTIVITY_KEEP);
      return sendJson(response, 200, { items: items.slice(0, limit) }, origin);
    }
    if (request.method === "GET" && url.pathname === "/content") {
      return sendJson(response, 200, await listContentPage(url.searchParams), origin);
    }
    if (request.method === "PUT" && url.pathname === "/content") {
      const body = await readJson(request);
      const item = await saveContentItem(body.item || body, body.revisionId);
      return sendJson(response, 200, {
        item,
        message: "已保存，刷新公开站即可看到。",
        publicUrl: `http://localhost:${SITE_PORT}/zh/`,
      }, origin);
    }
    if (request.method === "PUT" && url.pathname === "/content/batch") {
      const body = await readJson(request);
      return sendJson(response, 200, await updateContentBatch(body.ids, body.status), origin);
    }
    const contentItemMatch = url.pathname.match(/^\/content\/([^/]+)$/);
    if (request.method === "GET" && contentItemMatch) {
      const repository = await contentStore();
      const item = repository.get(decodeURIComponent(contentItemMatch[1]));
      return item ? sendJson(response, 200, { item, issueCount: contentIssueCount(item) }, origin) : sendJson(response, 404, { error: "找不到对应内容" }, origin);
    }
    if (request.method === "DELETE" && contentItemMatch) {
      const repository = await contentStore();
      const id = decodeURIComponent(contentItemMatch[1]);
      const current = repository.get(id);
      if (!current) return sendJson(response, 404, { error: "找不到对应内容" }, origin);
      repository.remove(id);
      await bumpSite();
      await exportPublicContent();
      return sendJson(response, 200, { message: `已删除「${current.title}」` }, origin);
    }
    const contentReprocessMatch = url.pathname.match(/^\/content\/([^/]+)\/reprocess$/);
    if (request.method === "POST" && contentReprocessMatch) {
      const repository = await contentStore();
      const item = repository.get(decodeURIComponent(contentReprocessMatch[1]));
      if (!item) return sendJson(response, 404, { error: "找不到对应内容" }, origin);
      if (!INGEST_BLOCKS.includes(item.blockType)) throw new Error("当前板块暂不支持 AI 重新处理");
      const body = await readJson(request);
      const sourceUrl = item.sourceUrl || item.payload?.url;
      if (!sourceUrl) throw new Error("这条内容没有来源链接，无法重新处理");
      const run = createRun({
        url: sourceUrl,
        note: body.note || "请找出遗漏并改善这条内容，保留可靠信息。",
        block: item.blockType,
        tool: body.tool,
        model: body.model,
        mode: "reprocess",
        contentId: item.id,
      });
      return sendJson(response, 202, publicRun(run), origin);
    }
    const contentCandidatesMatch = url.pathname.match(/^\/content\/([^/]+)\/candidates$/);
    if (request.method === "GET" && contentCandidatesMatch) {
      return sendJson(response, 200, await listCandidates(decodeURIComponent(contentCandidatesMatch[1])), origin);
    }
    const contentApplyCandidateMatch = url.pathname.match(/^\/content\/([^/]+)\/candidates\/([^/]+)\/apply$/);
    if (request.method === "POST" && contentApplyCandidateMatch) {
      const item = await applyCandidate(decodeURIComponent(contentApplyCandidateMatch[1]), contentApplyCandidateMatch[2]);
      return sendJson(response, 200, { item, message: "候选版本已应用，刷新公开站即可看到。" }, origin);
    }
    const contentAbandonCandidateMatch = url.pathname.match(/^\/content\/([^/]+)\/candidates\/([^/]+)\/abandon$/);
    if (request.method === "POST" && contentAbandonCandidateMatch) {
      return sendJson(response, 200, await abandonCandidate(decodeURIComponent(contentAbandonCandidateMatch[1]), contentAbandonCandidateMatch[2]), origin);
    }
    const runMatch = url.pathname.match(/^\/runs\/([^/]+)(?:\/(events|cancel|retry|save))?$/);
    if (runMatch) {
      const run = runs.get(decodeURIComponent(runMatch[1]));
      if (!run) return sendJson(response, 404, { error: "找不到这次分析" }, origin);
      const action = runMatch[2];
      if (request.method === "GET" && !action) {
        return sendJson(response, 200, publicRun(run), origin);
      }
      if (request.method === "GET" && action === "events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        });
        response.write("retry: 1500\n\n");
        const after = Number(request.headers["last-event-id"] || url.searchParams.get("after") || 0);
        const history = run.events.length ? run.events : await readStoredRunEvents(run.id);
        for (const event of history.filter((item) => item.sequence > after)) {
          response.write(`id: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
        }
        if (runIsTerminal(run)) return response.end();
        run.subscribers.add(response);
        request.on("close", () => run.subscribers.delete(response));
        return;
      }
      if (request.method === "POST" && action === "cancel") {
        return sendJson(response, 200, publicRun(cancelRun(run)), origin);
      }
      if (request.method === "POST" && action === "retry") {
        const body = await readJson(request);
        const next = createRun({
          ...run.input,
          ...(body.tool ? { tool: body.tool } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
        });
        return sendJson(response, 202, publicRun(next), origin);
      }
      if (request.method === "POST" && action === "save") {
        if (run.status !== "awaiting_review") throw new Error("这次分析还不能保存");
        const body = await readJson(request);
        const draft = { ...(body.draft || run.draft || {}) };
        const result = run.input.mode === "reprocess"
          ? await saveCandidate(run, draft)
          : await saveDraft(draft);
        run.status = "saved";
        run.draft = { ...run.draft, ...draft };
        run.updatedAt = new Date().toISOString();
        persistRuns();
        return sendJson(response, 200, { ...result, run: publicRun(run) }, origin);
      }
      return sendJson(response, 405, { error: "当前操作不支持" }, origin);
    }
    if (request.method === "GET" && url.pathname === "/site") {
      return sendJson(response, 200, JSON.parse(await fs.readFile(SITE_FILE, "utf8")), origin);
    }
    if (request.method === "PUT" && url.pathname === "/site") {
      const body = await readJson(request);
      const site = JSON.parse(await fs.readFile(SITE_FILE, "utf8"));
      if (body.rankingUrl) site.rankingUrl = String(body.rankingUrl).trim();
      site.updatedAt = shanghaiDate();
      await writeJsonAtomic(SITE_FILE, site);
      recordActivity({ type: "site.saved", message: "保存站点设置" });
      return sendJson(response, 200, site, origin);
    }
    return sendJson(response, 404, { error: "接口不存在" }, origin);
  } catch (error) {
    const status = Number(error?.statusCode) || 400;
    return sendJson(response, status, {
      error: error instanceof Error ? error.message : "处理失败",
      ...(error?.code ? { code: error.code } : {}),
    }, origin || undefined);
  }
});

await restoreRuns().catch(() => undefined);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Curator service: http://127.0.0.1:${PORT}`);
  console.log(`Allowed browser origins: ${[...allowedOrigins].join(", ")}`);
});
