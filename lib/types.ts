export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export type Localized = Record<Locale, string>;

export function text(value: Localized, locale: Locale): string {
  return value[locale];
}

export type ResourceKind = "tool" | "skill" | "open-source";

export type Tool = {
  id: string;
  slug: string;
  name: string;
  url: string;
  logo?: string;
  kind?: ResourceKind;
  /** One second-level category within the Tools board. */
  category: string;
  /** Card attributes such as pricing, platform and traits. */
  tags: string[];
  status: "active" | "archived";
  verdict: Localized;
  summary: Localized;
  description?: Localized;
};

export type SiteConfig = {
  updatedAt: string;
  rankingUrl: string;
};
