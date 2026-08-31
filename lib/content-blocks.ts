import type { Localized } from "./types";

export const ENABLED_CONTENT_BLOCK_IDS = ["tool", "skill", "project", "prompt"] as const;

export type ContentBlockId = "tool" | "skill" | "project" | "prompt" | "course" | "article";
export type EnabledContentBlockId = (typeof ENABLED_CONTENT_BLOCK_IDS)[number];
export type ContentStatus = "draft" | "active" | "archived";

export type ContentLink = {
  label: string;
  url: string;
  kind?: "official" | "docs" | "repository" | "reference" | "other";
};

export type ContentItem<TPayload = unknown> = {
  id: string;
  blockType: ContentBlockId;
  slug: string;
  title: string;
  status: ContentStatus;
  category: string;
  tags: string[];
  sourceUrl?: string;
  /** Stable imported order; not a user-facing priority system. */
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  payload: TPayload;
};

export type ToolPayload = {
  logo?: string;
  tagline: Localized;
  summary: Localized;
  description?: Localized;
  url: string;
};

export type ArticlePayload = {
  summary: Localized;
  body: string;
  links: ContentLink[];
};

export type PromptVariable = {
  name: string;
  description: string;
  example?: string;
};

export type PromptExample = {
  input: string;
  output: string;
};

export type PromptPayload = {
  summary: Localized;
  prompt: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  links: ContentLink[];
};

type CoursePayload = ArticlePayload & {
  level?: "beginner" | "intermediate" | "advanced";
  chapters?: Array<{ title: string; slug: string; order: number }>;
};

export type ContentPayloadByBlock = {
  tool: ToolPayload;
  skill: ArticlePayload;
  project: ArticlePayload;
  prompt: PromptPayload;
  course: CoursePayload;
  article: ArticlePayload;
};

type ContentBlockDefinition = {
  id: ContentBlockId;
  enabled: boolean;
  label: Localized;
  editor: "tool" | "article" | "prompt";
  renderer: "tool-card" | "article-page" | "prompt-page";
  exportTarget: { format: "json" | "markdown"; path: string };
};

/**
 * Shared metadata only. Payload validation stays at the Curator API boundary,
 * so the browser does not ship a second, divergent validation implementation.
 */
export const contentBlocks: Record<ContentBlockId, ContentBlockDefinition> = {
  tool: {
    id: "tool",
    enabled: true,
    label: { en: "Tools", zh: "工具" },
    editor: "tool",
    renderer: "tool-card",
    exportTarget: { format: "json", path: "data/tools.json" },
  },
  skill: {
    id: "skill",
    enabled: true,
    label: { en: "Skills", zh: "技能" },
    editor: "article",
    renderer: "article-page",
    exportTarget: { format: "markdown", path: "content/skills" },
  },
  project: {
    id: "project",
    enabled: true,
    label: { en: "Projects", zh: "项目" },
    editor: "article",
    renderer: "article-page",
    exportTarget: { format: "markdown", path: "content/projects" },
  },
  prompt: {
    id: "prompt",
    enabled: true,
    label: { en: "Prompts", zh: "提示词" },
    editor: "prompt",
    renderer: "prompt-page",
    exportTarget: { format: "markdown", path: "content/prompts" },
  },
  course: {
    id: "course",
    enabled: false,
    label: { en: "Courses", zh: "课程" },
    editor: "article",
    renderer: "article-page",
    exportTarget: { format: "markdown", path: "content/courses" },
  },
  article: {
    id: "article",
    enabled: false,
    label: { en: "Articles", zh: "专题文章" },
    editor: "article",
    renderer: "article-page",
    exportTarget: { format: "markdown", path: "content/articles" },
  },
};

export function isEnabledContentBlockId(value: string): value is EnabledContentBlockId {
  return (ENABLED_CONTENT_BLOCK_IDS as readonly string[]).includes(value);
}
