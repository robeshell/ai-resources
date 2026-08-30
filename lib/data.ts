import siteJson from "@/data/site.json";
import toolsJson from "@/data/tools.json";
import type { SiteConfig, Tool } from "./types";

function validateResources(resources: Tool[]): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const resource of resources) {
    if (!resource.verdict?.en?.trim() || !resource.verdict?.zh?.trim()) {
      throw new Error(`资源 ${resource.id} 缺少中英文定位文案（verdict）`);
    }
    if (!resource.summary?.en?.trim() || !resource.summary?.zh?.trim()) {
      throw new Error(`资源 ${resource.id} 缺少中英文简介（summary）`);
    }
    if (ids.has(resource.id) || slugs.has(resource.slug)) {
      throw new Error(`资源 ${resource.id} 的 id 或 slug 重复`);
    }
    ids.add(resource.id);
    slugs.add(resource.slug);
  }
}

export function loadSite(): SiteConfig {
  return siteJson;
}

export function loadResources(): Tool[] {
  const tools = toolsJson.items as Tool[];
  validateResources(tools);
  return tools
    .filter((tool) => tool.status === "active")
    .map((tool) => ({ ...tool, kind: tool.kind ?? "tool" }) as Tool);
}
