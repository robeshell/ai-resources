export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export type Localized = Record<Locale, string>;

export function text(value: Localized, locale: Locale): string {
  return value[locale];
}

export type Pricing = "free" | "freemium" | "paid" | "api";

export type Platform = "web" | "app" | "api" | "cli";

export type ResourceKind = "tool" | "skill" | "open-source";

export type Tool = {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo?: string;
  kind?: ResourceKind;
  pricing: Pricing;
  platforms: Platform[];
  status: "active" | "archived";
  verdict: Localized;
  summary: Localized;
  description?: Localized;
};

export type SiteConfig = {
  updatedAt: string;
  rankingUrl: string;
};
