import net from "node:net";
import { knownTag } from "./curator-tags.mjs";

export const CONTENT_BLOCKS = ["tool", "skill", "project", "prompt", "course", "article"];
const LONG_FORM_BLOCKS = ["skill", "project", "course", "article"];

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
export function assertUrlShape(value) {
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

export function assertContentItemShape(item) {
  if (!item || typeof item !== "object") throw new Error("内容必须是对象");
  if (!CONTENT_BLOCKS.includes(item.blockType)) throw new Error("未知内容板块");
  if (!String(item.id || item.slug || "").trim()) throw new Error("内容缺少 id 或 slug");
  if (!String(item.title || "").trim()) throw new Error("标题不能为空");
  if (!item.payload || typeof item.payload !== "object") throw new Error("内容 payload 无效");
}

function assertLocalized(value, label) {
  if (!String(value?.zh || "").trim() || !String(value?.en || "").trim()) {
    throw new Error(`已发布的内容必须填写中英文${label}`);
  }
}

/**
 * Save-time rules mirror what the public build demands (lib/data.ts and the
 * block renderers), so "saved fine" can never turn into a broken build later.
 * Only published items carry the full contract; drafts stay editable.
 */
export function validateContentPayload(item) {
  const payload = item.payload || {};
  for (const link of payload.links || []) {
    if (!String(link?.label || "").trim() || !String(link?.url || "").trim()) throw new Error("相关链接需要同时填写名称和地址");
    assertUrlShape(link.url);
  }
  if (item.status !== "active") return;
  assertLocalized(payload.summary, "简介");
  // 标签是唯一的分类维度，发布后没有标签就等于进不了任何筛选。
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
  if (!tags.some((tag) => knownTag(tag)?.group === "task")) throw new Error("至少选择一个用途标签");
  if (tags.filter((tag) => knownTag(tag)?.group === "pricing").length > 1) throw new Error("定价标签只能选一个");
  if (item.blockType === "tool") {
    assertLocalized(payload.tagline, "定位");
    assertUrlShape(payload.url);
  }
  if (LONG_FORM_BLOCKS.includes(item.blockType) && !String(payload.body || "").trim()) {
    throw new Error("已发布的长文必须填写正文");
  }
  if (item.blockType === "prompt" && !String(payload.prompt || "").trim()) {
    throw new Error("已发布的提示词必须填写正文");
  }
}

/** Editorial completeness, surfaced as the library's "问题" filter. Unlike
 *  validateContentPayload this never blocks a save — drafts are allowed to be
 *  incomplete, they just get counted. */
export function contentIssueCount(item) {
  const payload = item.payload || {};
  let count = 0;
  if (!String(item.title || "").trim()) count += 1;
  if (!String(item.slug || "").trim()) count += 1;
  if (!String(payload.summary?.zh || "").trim() || !String(payload.summary?.en || "").trim()) count += 1;
  if (item.blockType === "tool" && (!String(payload.url || "").trim() || !String(payload.tagline?.zh || "").trim() || !String(payload.tagline?.en || "").trim())) count += 1;
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [];
  if (!tags.some((tag) => knownTag(tag)?.group === "task")) count += 1;
  // Agent 提的新标签不会自动进词表，留在这里等人处理。
  if (tags.some((tag) => !knownTag(tag))) count += 1;
  if (["skill", "project"].includes(item.blockType) && !String(payload.body || "").trim()) count += 1;
  if (item.blockType === "prompt" && !String(payload.prompt || "").trim()) count += 1;
  return count;
}
