import { notFound } from "next/navigation";
import { HomeTools } from "@/components/HomeTools";
import { loadCategories, loadResources, loadSite } from "@/lib/data";
import { ui } from "@/lib/i18n";
import { isLocale } from "@/lib/types";

export default async function LocaleHome({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const categories = loadCategories();
  const resources = loadResources();
  const site = loadSite();
  const t = ui(locale);

  return (
    <>
      <header className="compact-intro">
        <p className="compact-intro-kicker">{t.compactIntroKicker}</p>
        <div>
          <h1>{t.compactIntroTitle}</h1>
          <p>{t.compactIntroBody}</p>
        </div>
      </header>
      <HomeTools all={resources} categories={categories} locale={locale} rankingUrl={site.rankingUrl} />
    </>
  );
}
