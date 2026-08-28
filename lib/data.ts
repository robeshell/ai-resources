import categoriesJson from "@/data/categories.json";
import toolsJson from "@/data/tools.json";
import siteJson from "@/data/site.json";
import resourcesJson from "@/data/resources.json";
import scenariosJson from "@/data/scenarios.json";
import type { Category, Scenario, SiteConfig, Tool } from "./types";

function validateResources(resources: Tool[]): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const categoryIds = new Set(categoriesJson.items.map((category) => category.id));
  for (const resource of resources) {
    if (!resource.verdict?.en?.trim() || !resource.verdict?.zh?.trim()) {
      throw new Error(`Resource ${resource.id} is missing a bilingual verdict`);
    }
    if (!resource.summary?.en?.trim() || !resource.summary?.zh?.trim()) {
      throw new Error(`Resource ${resource.id} is missing a bilingual summary`);
    }
    if (!categoryIds.has(resource.category)) {
      throw new Error(`Resource ${resource.id} uses unknown category ${resource.category}`);
    }
    if (ids.has(resource.id) || slugs.has(resource.slug)) {
      throw new Error(`Resource ${resource.id} has a duplicate id or slug`);
    }
    ids.add(resource.id);
    slugs.add(resource.slug);
  }
}

export function loadSite(): SiteConfig {
  return siteJson;
}

export function loadCategories(): Category[] {
  return [...categoriesJson.items].sort((a, b) => a.order - b.order) as Category[];
}

export function loadTools(): Tool[] {
  const tools = toolsJson.items as Tool[];
  validateResources(tools);
  return tools.filter((tool) => tool.status === "active");
}

export function loadResources(): Tool[] {
  const tools = loadTools().map((tool) => ({ ...tool, kind: tool.kind ?? "tool" }) as Tool);
  const resources = resourcesJson.items as Tool[];
  const active = [...tools, ...resources].filter((resource) => resource.status === "active");
  validateResources(active);
  return active;
}

export function loadScenarios(): Scenario[] {
  return [...scenariosJson.items].sort((a, b) => a.order - b.order) as Scenario[];
}

export function loadCategory(slug: string): Category | undefined {
  return loadCategories().find((category) => category.slug === slug);
}

export function loadTool(slug: string): Tool | undefined {
  return loadResources().find((tool) => tool.slug === slug);
}

export const loadResource = loadTool;

export function featuredTools(): Tool[] {
  return loadResources().filter((tool) => tool.featured);
}

export function toolsInCategory(slug: string): Tool[] {
  return loadResources().filter((tool) => tool.category === slug);
}

export function relatedTools(tool: Tool): Tool[] {
  const all = loadResources();
  return tool.relatedSlugs
    .map((slug) => all.find((item) => item.slug === slug))
    .filter((item): item is Tool => Boolean(item));
}

export function rankingModelsUrl(): string {
  return `${loadSite().rankingUrl.replace(/\/$/, "")}/models/`;
}
