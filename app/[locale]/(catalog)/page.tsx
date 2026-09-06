import { notFound } from "next/navigation";
import { HomeTools } from "@/components/HomeTools";
import { loadResources } from "@/lib/data";
import { loadPublicContent } from "@/lib/public-content";
import { ui } from "@/lib/i18n";
import { isLocale } from "@/lib/types";

export default async function LocaleHome({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const resources = loadResources();
  const content = loadPublicContent();
  const t = ui(locale);

  return (
    <>
      <h1 className="sr-only">{t.compactIntroTitle}</h1>
      <HomeTools all={resources} content={content} locale={locale} />
    </>
  );
}
