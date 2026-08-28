import type { Tool } from "./types";

function withBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}${path}`;
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function googleFavicon(url: string): string | null {
  const host = hostnameOf(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export function logoCandidates(tool: Tool): string[] {
  const extra = tool.logo && !tool.logo.startsWith("data:") ? [withBase(tool.logo)] : [];
  const local = [withBase(`/logos/${tool.id}.png`), withBase(`/logos/${tool.id}.svg`)];
  const remote = googleFavicon(tool.url);
  return [...extra, ...local, remote].filter((value): value is string => Boolean(value));
}
