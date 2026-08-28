import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageShell";
import { ToolList } from "@/components/ToolList";
import { loadCategories, loadCategory, toolsInCategory } from "@/lib/data";
import { ui } from "@/lib/i18n";
import { isLocale, text } from "@/lib/types";

export function generateStaticParams() {
  return loadCategories().flatMap((category) =>
    ["en", "zh"].map((locale) => ({ locale, slug: category.slug })),
  );
}

export const dynamicParams = false;

export default async function CategoryPage({
  params,
}: PageProps<"/[locale]/c/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const category = loadCategory(slug);
  if (!category) notFound();
  const t = ui(locale);
  const tools = toolsInCategory(slug);

  return (
    <>
      <PageHeading title={text(category.name, locale)} meta={text(category.blurb, locale)} />
      {tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.empty}</p>
      ) : (
        <ToolList tools={tools} locale={locale} />
      )}
    </>
  );
}
