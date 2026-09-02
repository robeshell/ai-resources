import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { LOCALES, isLocale } from "@/lib/types";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return locale === "zh"
    ? { title: "找个合适的 AI，开始做事", description: "真正值得用的 AI 工具、技能和开源项目，按用途整理。" }
    : { title: "Find something useful. Get to work.", description: "Useful AI products, skills, projects, sites and prompts, sorted by what they help you do." };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const lang = locale === "zh" ? "zh-CN" : "en";
  return (
    <div lang={lang} className={locale === "zh" ? "locale-zh" : undefined}>
      <SiteChrome locale={locale}>
        {children}
      </SiteChrome>
    </div>
  );
}
