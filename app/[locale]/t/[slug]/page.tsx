import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolList } from "@/components/ToolList";
import { ToolLogo } from "@/components/ToolLogo";
import { loadCategories, loadResource, loadResources, rankingModelsUrl, relatedTools } from "@/lib/data";
import { localePath, ui } from "@/lib/i18n";
import { isLocale, text } from "@/lib/types";

export function generateStaticParams() {
  return loadResources().flatMap((tool) =>
    ["en", "zh"].map((locale) => ({ locale, slug: tool.slug })),
  );
}

export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/[locale]/t/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const resource = loadResource(slug);
  if (!resource) return {};
  return {
    title: resource.name,
    description: text(resource.summary, locale),
    openGraph: { title: resource.name, description: text(resource.summary, locale), images: [] },
    twitter: { title: resource.name, description: text(resource.summary, locale), images: [] },
  };
}

export default async function ToolPage({
  params,
}: PageProps<"/[locale]/t/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const tool = loadResource(slug);
  if (!tool) notFound();
  const t = ui(locale);
  const category = loadCategories().find((item) => item.id === tool.category);
  const related = relatedTools(tool);
  const modelsUrl = rankingModelsUrl();

  return (
    <div className="tool-detail">
      {category ? (
        <Link href={localePath(locale, `/c/${category.slug}`)} className="back-link">
          <span aria-hidden="true">←</span>
          {t.backToCategory}
        </Link>
      ) : null}
      <header className="tool-hero">
        <ToolLogo tool={tool} size={48} />
        <div className="min-w-0">
          <p className="tool-detail-label">
            {t.resourceKinds[tool.kind ?? "tool"]} / {category ? text(category.name, locale) : t.siteName} / {t.pricing[tool.pricing]}
          </p>
          <h1 id="page-title">{tool.name}</h1>
          <p>{text(tool.verdict, locale)}</p>
        </div>
      </header>
      <p className="tool-summary">{text(tool.summary, locale)}</p>
      <p className="tool-actions">
        {category ? (
          <Link href={localePath(locale, `/c/${category.slug}`)} className="quiet-link">
            {text(category.name, locale)}
          </Link>
        ) : null}
        <a href={tool.url} className="btn-open t-learn" rel="noreferrer" target="_blank">
          {t.visit}
          <span className="t-learn-chevron" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" stroke="currentColor" strokeWidth="1.5" />
              <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
        </a>
      </p>
      {related.length > 0 ? (
        <section className="tool-section">
          <h2>{t.alternatives}</h2>
          <ToolList tools={related} locale={locale} />
        </section>
      ) : null}
      {tool.relatedModelIds.length > 0 ? (
        <section className="tool-section">
          <h2>{t.relatedModels}</h2>
          <ul className="model-links">
            {tool.relatedModelIds.map((modelId) => (
              <li key={modelId}>
                <a href={modelsUrl} rel="noreferrer" target="_blank">
                  {modelId}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
