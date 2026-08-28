export default function Loading() {
  return (
    <>
      <header className="home-hero" aria-hidden="true">
        <span className="skeleton-line skeleton-tagline" />
      </header>
      <div className="home-stack" aria-hidden="true">
        <div className="skeleton-search" />
        {Array.from({ length: 3 }, (_, section) => (
          <section key={section} className="category-block">
            <div className="category-head">
              <span className="skeleton-line skeleton-line-title" />
              <span className="skeleton-line skeleton-line-count" />
            </div>
            <div className="tool-grid">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="catalog-card is-skeleton">
                  <span className="catalog-stage">
                    <span className="logo-frame">
                      <span className="logo-skeleton" />
                    </span>
                  </span>
                  <span className="catalog-meta skeleton-copy">
                    <span className="skeleton-line" />
                    <span className="skeleton-line skeleton-line-short" />
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
