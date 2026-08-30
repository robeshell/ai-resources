import Link from "next/link";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { MarkdownBody } from "@/components/MarkdownBody";
import { ui } from "@/lib/i18n";
import type { PublicContentDocument } from "@/lib/public-content";
import { text, type Locale } from "@/lib/types";

export function PublicContentPage({ item, locale }: { item: PublicContentDocument; locale: Locale }) {
  const t = ui(locale);
  return (
    <article className="public-article">
      <Link href={`/${locale}/#catalog`} className="public-article-back">← {t.backToLibrary}</Link>
      <header>
        <p>{t.contentBlock[item.blockType]}</p>
        <h1>{item.title}</h1>
        <span>{text(item.summary, locale)}</span>
      </header>
      {item.blockType === "prompt" ? (
        <>
          <section>
            <div className="prompt-copy-heading"><h2>{t.promptHeading}</h2><CopyPromptButton value={item.prompt || ""} locale={locale} /></div>
            <pre className="prompt-copy"><code>{item.prompt}</code></pre>
          </section>
          {item.variables?.length ? (
            <section>
              <h2>{t.variablesHeading}</h2>
              <dl>
                {item.variables.map((variable) => (
                  <div key={variable.name}><dt>{variable.name}</dt><dd>{variable.description}{variable.example ? ` · ${variable.example}` : ""}</dd></div>
                ))}
              </dl>
            </section>
          ) : null}
          {item.examples?.length ? (
            <section>
              <h2>{t.examplesHeading}</h2>
              {item.examples.map((example, index) => (
                <div className="prompt-example" key={index}><strong>{example.input}</strong><p>{example.output}</p></div>
              ))}
            </section>
          ) : null}
        </>
      ) : <MarkdownBody source={item.body} />}
      {item.links.length ? (
        <footer>
          <h2>{t.linksHeading}</h2>
          {item.links.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>)}
        </footer>
      ) : null}
    </article>
  );
}
