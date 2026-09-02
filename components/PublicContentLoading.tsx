import type { PublicContentDocument } from "@/lib/public-content";

type BlockType = PublicContentDocument["blockType"];

function ReadingSkeleton() {
  return <div className="public-detail-loading-reading">
    {Array.from({ length: 3 }, (_, index) => <section key={index}>
      <span className="skeleton-line public-detail-loading-heading" />
      <span className="skeleton-line" />
      <span className="skeleton-line" />
      <span className="skeleton-line public-detail-loading-copy-short" />
    </section>)}
  </div>;
}

export function PublicContentLoading({ block }: { block: BlockType }) {
  return <article className={`public-detail public-detail--${block} public-detail-loading`} aria-hidden="true">
    <span className="skeleton-line public-detail-loading-back" />
    <header className="public-detail-header">
      <span className="skeleton-line public-detail-loading-title" />
      <span className="skeleton-line public-detail-loading-summary" />
      <span className="skeleton-line public-detail-loading-summary public-detail-loading-summary-short" />
    </header>
    {block === "prompt" ? <div className="public-detail-loading-prompt">
      <span className="skeleton-line public-detail-loading-prompt-title" />
      <span className="skeleton-line public-detail-loading-prompt-box" />
      <div><ReadingSkeleton /><ReadingSkeleton /></div>
    </div> : block === "site" ? <div className="public-detail-loading-site"><span className="skeleton-line public-detail-loading-prompt-box" /></div> : <div className={`public-detail-loading-${block}`}><ReadingSkeleton />{block === "project" ? <span className="skeleton-line public-detail-loading-aside" /> : null}</div>}
  </article>;
}
