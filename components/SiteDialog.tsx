"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ToolLogo } from "@/components/ToolLogo";
import { useMounted } from "@/components/Transitions";
import { ui } from "@/lib/i18n";
import { knownCategory, tagLabel } from "@/lib/tags";
import type { PublicContentDocument } from "@/lib/public-content";
import { text, type Locale } from "@/lib/types";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function closeDuration() {
  if (typeof window === "undefined") return 0;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  return parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur"),
  ) || 150;
}

function SiteDialogPanel({
  site,
  locale,
  headingId,
  closeSlot,
  onClose,
}: {
  site: PublicContentDocument;
  locale: Locale;
  headingId?: string;
  closeSlot?: React.ReactNode;
  onClose?: () => void;
}) {
  const t = ui(locale);
  const targetUrl = site.url || site.sourceUrl || site.links[0]?.url;
  let hostname = "";
  if (targetUrl) {
    try {
      hostname = new URL(targetUrl).hostname.replace(/^www\./, "");
    } catch {
      hostname = targetUrl;
    }
  }
  const categoryEntry = knownCategory(site.category, "site");
  const categoryLabel = categoryEntry ? categoryEntry.label[locale] : (locale === "zh" ? "站点" : "Site");
  const descriptionText = site.description ? text(site.description, locale) : "";

  return (
    <>
      <header className="dialog-header">
        <div className="dialog-tool-heading">
          <span className="dialog-logo">
            <ToolLogo
              tool={{
                id: site.id,
                name: site.title,
                logo: site.logo,
              }}
              size={48}
            />
          </span>
          <div>
            <div className="site-dialog-eyebrow-row">
              <span className="dialog-eyebrow">{categoryLabel}</span>
              {site.tags.map((tag) => (
                <span key={tag} className="site-dialog-tag-badge">
                  {tagLabel(tag, locale)}
                </span>
              ))}
            </div>
            <h2 id={headingId}>{site.title}</h2>
            {hostname ? <span className="site-dialog-hostname">{hostname}</span> : null}
          </div>
        </div>
        {closeSlot}
      </header>
      <div className="dialog-rule" />
      <p className="dialog-verdict">{text(site.summary, locale)}</p>
      {descriptionText ? (
        <div className="dialog-description">
          {descriptionText.split(/\n\s*\n/).filter(Boolean).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
      <div className="dialog-actions">
        {targetUrl ? (
          <a href={targetUrl} className="btn-open t-learn" rel="noreferrer" target="_blank">
            {locale === "zh" ? "访问站点" : "Visit site"} →
          </a>
        ) : null}
        {onClose ? (
          <button type="button" className="dialog-cancel" onClick={onClose}>
            {t.close}
          </button>
        ) : null}
      </div>
    </>
  );
}

export function SiteDialog({
  site,
  locale,
  onClose,
}: {
  site: PublicContentDocument | null;
  locale: Locale;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState<PublicContentDocument | null>(site);
  const [phase, setPhase] = useState<"idle" | "open" | "closing">("idle");
  const [tracked, setTracked] = useState<PublicContentDocument | null>(site);
  const mounted = useMounted();
  const t = ui(locale);

  if (site !== tracked) {
    setTracked(site);
    if (site) {
      setShown(site);
      setPhase("idle");
    } else if (phase !== "idle") {
      setPhase("closing");
    }
  }

  useEffect(() => {
    if (!site) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement) restoreRef.current = active;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [site]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => {
      setShown(null);
      setPhase("idle");
    }, closeDuration());
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!shown) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.getElementById("site-root");
    root?.setAttribute("inert", "");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      root?.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus({
        preventScroll: true,
      });
    };
  }, [onClose, shown]);

  if (!shown || !mounted) return null;

  const modalClass =
    phase === "open" ? " is-open" : phase === "closing" ? " is-closing" : "";

  return createPortal(
    <div
      className={`dialog-backdrop${modalClass}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`tool-dialog t-modal${modalClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`site-dialog-${shown.id}`}
      >
        <SiteDialogPanel
          site={shown}
          locale={locale}
          headingId={`site-dialog-${shown.id}`}
          onClose={onClose}
          closeSlot={
            <button
              ref={closeButtonRef}
              type="button"
              className="dialog-close"
              aria-label={t.close}
              onClick={onClose}
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          }
        />
      </section>
    </div>,
    document.body,
  );
}
