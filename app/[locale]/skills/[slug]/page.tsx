import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicContentPage } from "@/components/PublicContentPage";
import { loadPublicContent, loadPublicContentItem } from "@/lib/public-content";
import { isLocale, text } from "@/lib/types";

export function generateStaticParams() {
  // `output: export` rejects an empty param list for a dynamic segment, so an
  // unpublished block prerenders one placeholder route that hits notFound().
  const params = loadPublicContent("skill").flatMap((item) => ["en", "zh"].map((locale) => ({ locale, slug: item.slug })));
  return params.length ? params : ["en", "zh"].map((locale) => ({ locale, slug: "__empty__" }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/skills/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const item = loadPublicContentItem("skill", slug);
  return item ? { title: item.title, description: text(item.summary, locale) } : {};
}

export default async function SkillPage({ params }: PageProps<"/[locale]/skills/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const item = loadPublicContentItem("skill", slug);
  if (!item) notFound();
  return <PublicContentPage item={item} locale={locale} />;
}
