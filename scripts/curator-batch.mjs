import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Drive a list of URLs through the ingest server one at a time.
 *
 * Rebuilding the catalog means ~70 runs. Doing that through the browser is
 * an hour of clicking, and a tab that sleeps mid-run loses the stream. This
 * talks to the same POST /runs the UI uses, so there is no second ingest path
 * to keep in sync — it just holds the queue and saves what comes back.
 *
 * Runs are sequential on purpose: each one spawns a real Agent CLI, and four
 * of those at once compete for the same rate limit and turn a 90s run into a
 * five-minute one.
 *
 *   node scripts/curator-batch.mjs                    # 预演，只打印要收什么
 *   node scripts/curator-batch.mjs --write            # 真收
 *   node scripts/curator-batch.mjs --write --only 5   # 先跑前 5 条试水
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST_FILE = process.env.CURATOR_BATCH_LIST || path.join(ROOT, ".curator", "ingest-list.txt");
const SERVER = process.env.CURATOR_SERVER || `http://127.0.0.1:${process.env.CURATOR_PORT || 4317}`;
const BLOCKS = ["tool", "skill", "project", "prompt"];

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

export function parseList(text) {
  const entries = [];
  const problems = [];
  text.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const [block, url, note = ""] = line.split("|").map((part) => part.trim());
    if (!BLOCKS.includes(block)) {
      problems.push(`第 ${index + 1} 行：板块「${block}」不认识`);
      return;
    }
    if (!/^https?:\/\//.test(url || "")) {
      problems.push(`第 ${index + 1} 行：链接不是 http(s) 开头`);
      return;
    }
    entries.push({ block, url, note, line: index + 1 });
  });
  return { entries, problems };
}

async function api(pathname, init) {
  const response = await fetch(`${SERVER}${pathname}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `${pathname} 返回 ${response.status}`);
  return body;
}

function durationLabel(ms) {
  const total = Math.round(ms / 1000);
  return total < 60 ? `${total} 秒` : `${Math.floor(total / 60)} 分 ${total % 60} 秒`;
}

/** Poll rather than subscribe to the SSE stream: this only needs the terminal
 *  state, and a dropped stream mid-batch would be one more thing to recover. */
async function waitForRun(id, { timeoutMs = 15 * 60 * 1000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const run = await api(`/runs/${id}`);
    if (["awaiting_review", "saved", "failed", "cancelled"].includes(run.status)) return run;
    if (Date.now() > deadline) throw new Error(`等待超时（${durationLabel(timeoutMs)}）`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const only = Number(argValue("--only", 0)) || 0;
  const { entries, problems } = parseList(await readFile(LIST_FILE, "utf8"));
  for (const problem of problems) console.error(`跳过 ${problem}`);
  const queue = only ? entries.slice(0, only) : entries;

  const counts = queue.reduce((all, entry) => ({ ...all, [entry.block]: (all[entry.block] || 0) + 1 }), {});
  console.log(`清单 ${LIST_FILE}`);
  console.log(`共 ${queue.length} 条：${Object.entries(counts).map(([block, n]) => `${block} ${n}`).join(" / ")}`);
  if (!write) {
    for (const entry of queue) console.log(`  ${entry.block.padEnd(8)} ${entry.url}`);
    console.log("\n预演结束。加 --write 才会真的收录。");
    return;
  }

  await api("/health").catch(() => {
    throw new Error(`连不上收录服务 ${SERVER}，先跑 npm run curator`);
  });

  const started = Date.now();
  const failed = [];
  for (const [index, entry] of queue.entries()) {
    const label = `[${index + 1}/${queue.length}] ${entry.url}`;
    const runStarted = Date.now();
    try {
      const created = await api("/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: entry.url, block: entry.block, note: entry.note }),
      });
      const run = await waitForRun(created.id);
      if (run.status !== "awaiting_review") {
        throw new Error(run.error || `整理${run.status === "cancelled" ? "被取消" : "失败"}`);
      }
      const saved = await api(`/runs/${run.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const tags = (run.draft?.tags || []).join(" ") || "（无标签）";
      console.log(`${label}\n    ✓ ${saved.item?.title || run.draft?.name} · ${durationLabel(Date.now() - runStarted)} · ${tags}`);
    } catch (error) {
      failed.push({ ...entry, reason: error.message });
      console.error(`${label}\n    ✗ ${error.message}`);
    }
  }

  console.log(`\n收完 ${queue.length - failed.length}/${queue.length} 条，用时 ${durationLabel(Date.now() - started)}`);
  if (failed.length) {
    console.log("失败的（可以自己改清单重跑）：");
    for (const entry of failed) console.log(`  ${entry.block} | ${entry.url} | ${entry.reason}`);
  }
  console.log("\n收完记得跑 npm run curator:export 生成公开站数据。");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
