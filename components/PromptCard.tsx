import Link from "next/link";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import type { PublicContentDocument } from "@/lib/public-content";
import { text, type Locale } from "@/lib/types";
import styles from "./PromptCard.module.css";

export function PromptCard({ item, locale }: { item: PublicContentDocument; locale: Locale }) {
  const href = `/${locale}/prompts/${item.slug}/`;

  return (
    <article className={styles.card}>
      <h4 className={styles.title}>
        <Link href={href}>{item.title}</Link>
      </h4>
      <p className={styles.summary}>{text(item.summary, locale)}</p>
      <div className={styles.actions}>
        <Link href={href} className={styles.detail}>
          {locale === "zh" ? "查看全文" : "View prompt"}
          <span aria-hidden="true">→</span>
        </Link>
        {item.prompt ? (
          <CopyPromptButton value={item.prompt} locale={locale} className={styles.copy} />
        ) : null}
      </div>
    </article>
  );
}
