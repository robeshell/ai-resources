export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export type Localized = Record<Locale, string>;

export function text(value: Localized, locale: Locale): string {
  return value[locale];
}

export type CategoryId =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "research"
  | "agents";

export type Pricing = "free" | "freemium" | "paid" | "api";

export type Platform = "web" | "app" | "api" | "cli";

export type ToolStatus = "active" | "archived";

export type ResourceKind = "tool" | "skill" | "open-source";

export type Category = {
  id: CategoryId;
  slug: string;
  order: number;
  name: Localized;
  blurb: Localized;
};

export type Tool = {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo?: string;
  kind?: ResourceKind;
  category: CategoryId;
  pricing: Pricing;
  platforms: Platform[];
  featured: boolean;
  status: ToolStatus;
  relatedModelIds: string[];
  relatedSlugs: string[];
  verdict: Localized;
  summary: Localized;
};

export type Scenario = {
  id: string;
  order: number;
  title: Localized;
  summary: Localized;
  outcome: Localized;
  resourceSlugs: string[];
};

export type SiteConfig = {
  updatedAt: string;
  rankingUrl: string;
};
