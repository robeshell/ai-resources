"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { localePath, ui } from "@/lib/i18n";
import { text, type Category, type Locale } from "@/lib/types";

export function CategoryTabs({
  locale,
  categories,
  active,
  onSelect,
}: {
  locale: Locale;
  categories: Category[];
  active?: string;
  onSelect?: (slug?: string) => void;
}) {
  const t = ui(locale);
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);
  const indicatorSize = 6;

  useLayoutEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;

    const moveTo = (tab: HTMLElement, animate: boolean) => {
      if (!animate) {
        const prev = pill.style.transition;
        pill.style.transition = "none";
        pill.style.transform = `translateX(${tab.offsetLeft + (tab.offsetWidth - indicatorSize) / 2}px)`;
        pill.style.width = `${indicatorSize}px`;
        void pill.offsetWidth;
        pill.style.transition = prev;
      } else {
        pill.style.transform = `translateX(${tab.offsetLeft + (tab.offsetWidth - indicatorSize) / 2}px)`;
        pill.style.width = `${indicatorSize}px`;
      }
    };

    const selected =
      (bar.querySelector('[aria-current="page"]') as HTMLElement | null) ??
      (bar.querySelector('[aria-selected="true"]') as HTMLElement | null) ??
      (bar.querySelector(".t-tab") as HTMLElement | null);
    if (selected) moveTo(selected, mountedRef.current);
    mountedRef.current = true;

    const onResize = () => {
      const current =
        (bar.querySelector('[aria-current="page"]') as HTMLElement | null) ??
        (bar.querySelector('[aria-selected="true"]') as HTMLElement | null) ??
        (bar.querySelector(".t-tab") as HTMLElement | null);
      if (current) moveTo(current, false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, locale]);

  return (
    <div ref={barRef} className="t-tabs site-tabs" role="tablist" aria-label={locale === "zh" ? "分类" : "Categories"}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {onSelect ? (
        <button
          type="button"
          className="t-tab"
          role="tab"
          aria-selected={!active}
          onClick={() => onSelect(undefined)}
        >
          {t.allCategories}
        </button>
      ) : (
        <Link
          href={localePath(locale)}
          className="t-tab"
          role="tab"
          aria-selected={!active}
          aria-current={!active ? "page" : undefined}
          transitionTypes={["nav-back"]}
        >
          {t.allCategories}
        </Link>
      )}
      {categories.map((category) => {
        const isActive = active === category.slug;
        return onSelect ? (
          <button
            key={category.id}
            type="button"
            className="t-tab"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(category.slug)}
          >
            {text(category.name, locale)}
          </button>
        ) : (
          <Link
            key={category.id}
            href={localePath(locale, `/c/${category.slug}`)}
            className="t-tab"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            transitionTypes={["nav-forward"]}
          >
            {text(category.name, locale)}
          </Link>
        );
      })}
    </div>
  );
}
