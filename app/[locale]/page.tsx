import { notFound } from "next/navigation";
import { HomeTools } from "@/components/HomeTools";
import { StaggerReveal } from "@/components/Transitions";
import { loadResources, loadSite } from "@/lib/data";
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
  const site = loadSite();
  const t = ui(locale);
  const updated = site.updatedAt.replaceAll("-", ".");

  return (
    <>
      <StaggerReveal as="header" className="compact-intro">
        <div>
          <span className="compact-intro-bar t-stagger-line t-stagger-line--1" aria-hidden="true" />
          <h1 className="t-stagger-line t-stagger-line--2">{t.compactIntroTitle}</h1>
        </div>
        <p className="t-stagger-line t-stagger-line--3">
          <span className="compact-intro-updated">{t.updatedInline} {updated}</span>
        </p>
      </StaggerReveal>
      <HomeTools all={resources} content={content} locale={locale} />
    </>
  );
}
