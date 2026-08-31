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
  /** Ids from data/tags.json. Pricing and platform used to be their own fields;
   *  they are tags now so the site has exactly one classification concept. */
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
