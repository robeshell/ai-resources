import Link from "next/link";
import { ToolLogo } from "@/components/ToolLogo";
import type { PublicContentDocument } from "@/lib/public-content";
import { text, type Locale } from "@/lib/types";
import styles from "./ResourceCard.module.css";

function sourceHost(item: PublicContentDocument) {
  const source = item.sourceUrl || item.links[0]?.url;
  if (!source) return null;
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function ResourceCard({ item, category, locale }: {
  item: PublicContentDocument;
  category: string;
  locale: Locale;
}) {
  const host = sourceHost(item);
  return (
    <Link href={`/${locale}/${item.blockType}s/${item.slug}/`} className={styles.card}>
      <div className={styles.heading}>
        <span className={styles.logo}>
          <ToolLogo tool={{ id: item.id, name: item.title, logo: item.logo }} size={24} />
        </span>
        <h3 className={styles.title}>{item.title}</h3>
        <span className={styles.arrow} aria-hidden="true">→</span>
      </div>
      <p className={styles.summary}>{text(item.summary, locale)}</p>
      <div className={styles.meta}>
        <span>{category}</span>
        {host && <span className={styles.source}>{host}</span>}
      </div>
    </Link>
  );
}
