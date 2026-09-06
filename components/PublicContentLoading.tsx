import type { PublicContentDocument } from "@/lib/public-content";
import styles from "./PublicContentLoading.module.css";

type BlockType = PublicContentDocument["blockType"];

function ReadingSkeleton() {
  return <div className={styles.reading}>
    {Array.from({ length: 3 }, (_, index) => <div className={styles.paragraph} key={index}>
      <span className={`${styles.line} ${styles.heading}`} />
      <span className={styles.line} />
      <span className={styles.line} />
      <span className={`${styles.line} ${styles.short}`} />
    </div>)}
  </div>;
}

function LinksSkeleton() {
  return <div className={styles.links}>
    <span className={`${styles.line} ${styles.heading}`} />
    <span className={styles.line} />
    <span className={`${styles.line} ${styles.short}`} />
  </div>;
}

export function PublicContentLoading({ block }: { block: BlockType }) {
  return <article className={`public-detail public-detail--${block} ${styles.loading}`} aria-busy="true" aria-hidden="true">
    <div className={styles.back}><span className={styles.line} /></div>
    <header className="public-detail-header">
      <div className={styles.titleRow}><span className={`${styles.line} ${styles.title}`} /></div>
      <div className={styles.summary}><span className={styles.line} /><span className={`${styles.line} ${styles.short}`} /></div>
    </header>
    {block === "prompt" ? (
      <div className="public-detail-prompt-layout">
        <section className="public-detail-prompt-copy">
          <div className={styles.promptHeading}>
            <span className={`${styles.line} ${styles.heading}`} />
            <span className={`${styles.line} ${styles.button}`} />
          </div>
          <div className={styles.promptBody}><ReadingSkeleton /></div>
        </section>
      </div>
    ) : block === "site" ? (
      <div className="public-detail-site-layout">
        <ReadingSkeleton />
        <span className={`${styles.line} ${styles.button}`} />
      </div>
    ) : (
      <div className={block === "project" ? "public-detail-project-layout has-links" : "public-detail-skill-layout"}>
        <ReadingSkeleton />
        <LinksSkeleton />
      </div>
    )}
  </article>;
}
