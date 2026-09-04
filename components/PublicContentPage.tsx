import Link from "next/link";
import Image from "next/image";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ui, type UiCopy } from "@/lib/i18n";
import type { PublicContentDocument } from "@/lib/public-content";
import { text, type Locale } from "@/lib/types";

type PageProps = { item: PublicContentDocument; locale: Locale };

function DetailHeader({ item, locale }: PageProps) {
  return <header className="public-detail-header">
    <div className="public-detail-title-row">
      {item.logo?.startsWith("/") ? <Image src={item.logo} alt="" width={48} height={48} unoptimized /> : null}
      <h1>{item.title}</h1>
    </div>
    <p>{text(item.summary, locale)}</p>
  </header>;
}

function ResourceLinks({ item, t, className = "" }: { item: PublicContentDocument; t: UiCopy; className?: string }) {
  const links = item.sourceUrl && !item.links.some((link) => link.url === item.sourceUrl)
    ? [{ label: t.sourceLink, url: item.sourceUrl }, ...item.links]
    : item.links;
  if (!links.length) return null;
  return <aside className={`public-detail-links ${className}`.trim()}>
    <h2>{t.linksHeading}</h2>
    <div>
      {links.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
        <span>{link.label}</span><span aria-hidden="true">↗</span>
      </a>)}
    </div>
  </aside>;
}

/** 正文缺当前语言、但另一语言有，就把读者引过去；两边都空则整块不渲染。 */
function LanguageNotice({ item, locale, t }: PageProps & { t: UiCopy }) {
  const other: Locale = locale === "en" ? "zh" : "en";
  if (!text(item.body, other).trim()) return null;
  return <div className="public-detail-language-notice">
    <p>{t.bodyUnavailable}</p>
    <Link href={`/${other}/${item.blockType}s/${item.slug}/`}>{t.readOtherLocale} →</Link>
  </div>;
}

function SkillDetail({ item, locale, t }: PageProps & { t: UiCopy }) {
  const body = text(item.body, locale).trim();
  return <div className="public-detail-skill-layout">
    <main className="public-detail-reading">{body ? <MarkdownBody source={body} /> : <LanguageNotice item={item} locale={locale} t={t} />}</main>
    <ResourceLinks item={item} t={t} className="public-detail-skill-links" />
  </div>;
}

function ProjectDetail({ item, locale, t }: PageProps & { t: UiCopy }) {
  const body = text(item.body, locale).trim();
  return <div className={`public-detail-project-layout${item.links.length || item.sourceUrl ? " has-links" : ""}`}>
    <main className="public-detail-project-body">{body ? <MarkdownBody source={body} /> : <LanguageNotice item={item} locale={locale} t={t} />}</main>
    <ResourceLinks item={item} t={t} className="public-detail-project-links" />
  </div>;
}

function SiteDetail({ item, locale }: PageProps) {
  const description = item.description ? text(item.description, locale) : "";
  const url = item.url || item.sourceUrl || item.links[0]?.url;
  return <div className="public-detail-site-layout">
    <section className="public-detail-site-copy">
      {description ? description.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>) : null}
    </section>
    {url ? <a className="public-detail-site-visit" href={url} target="_blank" rel="noreferrer">{locale === "zh" ? "访问站点" : "Visit site"}<span aria-hidden="true">↗</span></a> : null}
  </div>;
}

function PromptDetail({ item, locale, t }: PageProps & { t: UiCopy }) {
  return <div className="public-detail-prompt-layout">
    <section className="public-detail-prompt-copy">
      <div className="prompt-copy-heading"><h2>{t.promptHeading}</h2><CopyPromptButton value={item.prompt || ""} locale={locale} /></div>
      <pre className="prompt-copy"><code>{item.prompt}</code></pre>
    </section>
    <div className="public-detail-prompt-meta">
      {item.variables?.length ? (
        <section className="public-detail-variables">
          <h2>{t.variablesHeading}</h2>
          <dl>
            {item.variables.map((variable) => (
              <div key={variable.name}><dt>{variable.name}</dt><dd>{variable.description}{variable.example ? <small>{variable.example}</small> : null}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}
      {item.examples?.length ? (
        <section className="public-detail-examples">
          <h2>{t.examplesHeading}</h2>
          {item.examples.map((example, index) => (
            <div className="prompt-example" key={index}><strong>{example.input}</strong><p>{example.output}</p></div>
          ))}
        </section>
      ) : null}
    </div>
    <ResourceLinks item={item} t={t} className="public-detail-prompt-links" />
  </div>;
}

export function PublicContentPage({ item, locale }: PageProps) {
  const t = ui(locale);
  return (
    <article className={`public-detail public-detail--${item.blockType}`}>
      <Link href={`/${locale}/?kind=${item.blockType}#catalog`} className="public-detail-back">← {t.backToLibrary}</Link>
      <DetailHeader item={item} locale={locale} />
      {item.blockType === "skill" ? <SkillDetail item={item} locale={locale} t={t} /> : null}
      {item.blockType === "project" ? <ProjectDetail item={item} locale={locale} t={t} /> : null}
      {item.blockType === "site" ? <SiteDetail item={item} locale={locale} /> : null}
      {item.blockType === "prompt" ? <PromptDetail item={item} locale={locale} t={t} /> : null}
    </article>
  );
}
