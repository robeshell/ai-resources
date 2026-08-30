function withBase(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}${path}`;
}

export function logoCandidates(tool: { logo?: string }): string[] {
  if (!tool.logo || tool.logo.startsWith("data:")) return [];
  return [withBase(tool.logo)];
}
