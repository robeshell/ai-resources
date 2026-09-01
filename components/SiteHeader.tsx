import Link from "next/link";
import { AppearanceToggle } from "@/components/AppearanceToggle";
import { BrandMark } from "@/components/BrandMark";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { localePath, ui } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export function SiteHeader({
  locale,
  pathname,
}: {
  locale: Locale;
  pathname: string;
}) {
  const t = ui(locale);

  return (
    <header className="site-header" style={{ viewTransitionName: "site-header" }}>
      <div className="site-header-inner">
        <Link href={localePath(locale)} className="brand" transitionTypes={["nav-back"]}>
          <BrandMark size={34} />
          <span className="brand-name">{t.siteName}</span>
        </Link>
        <div className="site-header-actions">
          <AppearanceToggle locale={locale} />
          <LocaleSwitch locale={locale} pathname={pathname} />
        </div>
      </div>
    </header>
  );
}
