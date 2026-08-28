import Link from "next/link";
import { localePath, ui } from "@/lib/i18n";
import { text, type Locale, type Scenario, type Tool } from "@/lib/types";

export function ScenarioGrid({ scenarios, resources, locale }: { scenarios: Scenario[]; resources: Tool[]; locale: Locale }) {
  const t = ui(locale);
  const bySlug = new Map(resources.map((resource) => [resource.slug, resource]));

  return (
    <section id="scenarios" className="scenario-section" aria-labelledby="scenario-title">
      <div className="section-heading-row">
        <div>
          <p className="section-eyebrow">03 / {locale === "zh" ? "搭配" : "COMBINATIONS"}</p>
          <h2 id="scenario-title">{t.scenariosTitle}</h2>
        </div>
        <p>{t.scenariosIntro}</p>
      </div>
      <div className="scenario-grid">
        {scenarios.map((scenario, index) => {
          const items = scenario.resourceSlugs.map((slug) => bySlug.get(slug)).filter((resource): resource is Tool => Boolean(resource));
          return (
            <article key={scenario.id} className="scenario-card">
              <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
              <p className="scenario-outcome">{text(scenario.outcome, locale)}</p>
              <h3>{text(scenario.title, locale)}</h3>
              <p className="scenario-summary">{text(scenario.summary, locale)}</p>
              <div className="scenario-stack">
                <span>{t.scenarioResources}</span>
                <ul>
                  {items.map((resource) => (
                    <li key={resource.id}><Link href={localePath(locale, `/t/${resource.slug}`)}>{resource.name}</Link></li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
