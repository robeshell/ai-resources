import type { Locale } from "./types";

const copy = {
  en: {
    siteName: "AI Resources",
    updatedLabel: "Last updated",
    footerNote: "Less noise. Better tabs.",
    openTool: "Open tool",
    close: "Close",
    skip: "Skip to content",
    emptyTitle: "This board is still filling up",
    empty: "We'll publish when there's something worth writing.",
    compactIntroKicker: "Look it up, use it",
    compactIntroTitle: "Curated AI resources",
    updatedInline: "Updated",
    kindTool: "Tools",
    kindSkill: "Skills",
    kindOpenSource: "Open source",
    kindPrompt: "Prompts",
    catalogKinds: "Boards",
    filterTags: "Filter",
    clearTags: "Clear",
    readMore: "Read",
    backToLibrary: "Back to library",
    contentBlock: {
      skill: "Skill",
      project: "Project",
      prompt: "Prompt",
    },
    promptHeading: "Prompt",
    variablesHeading: "Variables",
    examplesHeading: "Examples",
    linksHeading: "Links",
    copyPrompt: "Copy prompt",
    copied: "Copied",
    resourceKinds: {
      tool: "Product",
      skill: "Skill",
      "open-source": "Open source",
    },
    langEn: "EN",
    langZh: "中文",
    themeGroup: "Appearance",
    themeLight: "Light",
    themeDark: "Dark",
    accentGroup: "Accent color",
    accents: {
      orange: "Orange",
      purple: "Violet",
      blue: "Blue",
      rose: "Rose",
    },
  },
  zh: {
    siteName: "AI 资源集",
    updatedLabel: "最近更新",
    footerNote: "少一点噪音，多一些好工具。",
    openTool: "打开工具",
    close: "关闭",
    skip: "跳到内容",
    emptyTitle: "这个板块还在攒东西",
    empty: "收够值得写的再发，宁少不凑。",
    compactIntroKicker: "即查即用",
    compactIntroTitle: "挑过一遍的 AI 资源",
    updatedInline: "更新于",
    kindTool: "工具",
    kindSkill: "技能",
    kindOpenSource: "开源项目",
    kindPrompt: "提示词",
    catalogKinds: "板块",
    filterTags: "筛选",
    clearTags: "清除",
    readMore: "阅读全文",
    backToLibrary: "返回资源库",
    contentBlock: {
      skill: "技能",
      project: "项目",
      prompt: "提示词",
    },
    promptHeading: "提示词",
    variablesHeading: "变量",
    examplesHeading: "示例",
    linksHeading: "相关链接",
    copyPrompt: "复制提示词",
    copied: "已复制",
    resourceKinds: {
      tool: "AI 产品",
      skill: "技能",
      "open-source": "开源项目",
    },
    langEn: "EN",
    langZh: "中文",
    themeGroup: "外观",
    themeLight: "浅色",
    themeDark: "深色",
    accentGroup: "主题色",
    accents: {
      orange: "橙色",
      purple: "紫色",
      blue: "蓝色",
      rose: "玫红",
    },
  },
} as const;

export type UiCopy = (typeof copy)[Locale];

export function ui(locale: Locale): UiCopy {
  return copy[locale];
}

export function resourcesLabel(locale: Locale, count: number): string {
  if (locale === "zh") return `${count} 项资源`;
  return count === 1 ? "1 resource" : `${count} resources`;
}


export function localePath(locale: Locale, path = ""): string {
  const suffix = path.startsWith("/") ? path : path ? `/${path}` : "";
  return `/${locale}${suffix}`;
}

export function switchLocalePath(
  currentLocale: Locale,
  nextLocale: Locale,
  pathname: string,
): string {
  const rest = pathname.replace(/^\/(en|zh)(?=\/|$)/, "") || "/";
  return `/${nextLocale}${rest === "/" ? "" : rest}`;
}
