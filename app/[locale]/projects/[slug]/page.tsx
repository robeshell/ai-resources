import { notFound } from "next/navigation";
import { PublicContentPage } from "@/components/PublicContentPage";
import { loadPublicContent, loadPublicContentItem } from "@/lib/public-content";
import { isLocale } from "@/lib/types";

export function generateStaticParams() {
  // `output: export` rejects an empty param list for a dynamic segment, so an
  // unpublished block prerenders one placeholder route that hits notFound().
  const params = loadPublicContent("project").flatMap((item) => ["en", "zh"].map((locale) => ({ locale, slug: item.slug })));
  return params.length ? params : ["en", "zh"].map((locale) => ({ locale, slug: "__empty__" }));
}

export const dynamicParams = false;

export default async function ProjectPage({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const item = loadPublicContentItem("project", slug);
  if (!item) notFound();
  return <PublicContentPage item={item} locale={locale} />;
}
