import type { Locale } from "@/lib/types";
import { ui } from "@/lib/i18n";

export function HeroCopy({
  locale,
  rankingUrl,
  resourceCount,
}: {
  locale: Locale;
  rankingUrl: string;
  resourceCount: number;
}) {
  const t = ui(locale);

  return (
    <header className="home-hero">
      <p className="home-kicker">
        <span className="signal-dot" aria-hidden="true" />
        {t.heroEyebrow}
      </p>
      <h1 className="home-display">{t.heroTitle}</h1>
      <p className="home-description">{t.heroBody}</p>
      <div className="hero-actions">
        <a href="#resources" className="btn-open">{t.heroPrimary}</a>
        <a href={`${rankingUrl.replace(/\/$/, "")}/models/`} className="hero-secondary" target="_blank" rel="noreferrer">
          {t.heroModels}
        </a>
      </div>
      <div className="hero-meta" aria-label={locale === "zh" ? "站点摘要" : "Site summary"}>
        <span>{resourceCount} {t.toolsLabel}</span>
        <span>ZH / EN</span>
        <span>{locale === "zh" ? "持续整理" : "UPDATED"}</span>
      </div>
    </header>
  );
}
