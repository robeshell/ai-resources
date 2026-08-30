"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/components/Transitions";
import { ToolDialogPanel } from "@/components/ToolSurfaces";
import { ui } from "@/lib/i18n";
import type { Locale, Tool } from "@/lib/types";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function closeDuration() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  return parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur"),
  ) || 150;
}

export function ToolDialog({
  tool,
  locale,
  onClose,
}: {
  tool: Tool | null;
  locale: Locale;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState<Tool | null>(tool);
  const [phase, setPhase] = useState<"idle" | "open" | "closing">("idle");
  const [tracked, setTracked] = useState<Tool | null>(tool);
  const mounted = useMounted();
  const t = ui(locale);

  if (tool !== tracked) {
    setTracked(tool);
    if (tool) {
      setShown(tool);
      setPhase("idle");
    } else if (phase !== "idle") {
      setPhase("closing");
    }
  }

  useEffect(() => {
    if (!tool) return;
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
  }, [tool]);

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
        aria-labelledby={`tool-dialog-${shown.id}`}
      >
        <ToolDialogPanel
          tool={shown}
          locale={locale}
          headingId={`tool-dialog-${shown.id}`}
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
