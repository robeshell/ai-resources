import { notFound } from "next/navigation";
import { HomeTools } from "@/components/HomeTools";
import { StaggerReveal } from "@/components/Transitions";
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
      <StaggerReveal as="header" className="compact-intro">
        <p className="compact-intro-kicker t-stagger-line t-stagger-line--1">{t.compactIntroKicker}</p>
        <div>
          <h1 className="t-stagger-line t-stagger-line--2">{t.compactIntroTitle}</h1>
          <p className="t-stagger-line t-stagger-line--3">{t.compactIntroBody}</p>
        </div>
      </StaggerReveal>
      <HomeTools all={resources} content={content} locale={locale} />
    </>
  );
}
