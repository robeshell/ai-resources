export default function Loading() {
  return (
    <>
      <header className="compact-intro" aria-hidden="true">
        <span className="skeleton-line skeleton-tagline compact-intro-kicker" />
        <div>
          <span className="skeleton-line skeleton-display" />
          <span className="skeleton-line skeleton-line-short" />
        </div>
      </header>
      <section className="catalog-only" aria-hidden="true">
        <div className="library-shell">
          <aside className="scene-rail">
            <span className="skeleton-line skeleton-line-title" />
            <nav>
              {Array.from({ length: 3 }, (_, index) => (
                <span key={index} className="skeleton-line" />
              ))}
            </nav>
          </aside>
          <div className="library-main">
            <header className="library-toolbar">
              <span className="skeleton-line skeleton-line-title" />
            </header>
            <div className="tool-grid">
              {Array.from({ length: 6 }, (_, index) => (
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
          </div>
        </div>
      </section>
    </>
  );
}
