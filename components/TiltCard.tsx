"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

const MAX = 4;

export function TiltCard({
  href,
  children,
  transitionTypes,
  category,
  onClick,
  className,
}: {
  href?: string;
  children: ReactNode;
  transitionTypes?: string[];
  category?: string;
  onClick?: () => void;
  className?: string;
}) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const tilt = tiltRef.current;
    const card = cardRef.current;
    if (!tilt || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const reset = () => {
      tilt.classList.remove("is-hover");
      card.classList.remove("is-tilting");
      card.style.setProperty("--tilt-rx", "0deg");
      card.style.setProperty("--tilt-ry", "0deg");
    };

    const track = (event: PointerEvent) => {
      if (reduce.matches) return;
      const box = tilt.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      const py = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      tilt.classList.add("is-hover");
      card.classList.add("is-tilting");
      card.style.setProperty("--tilt-ry", `${((px - 0.5) * MAX).toFixed(2)}deg`);
      card.style.setProperty("--tilt-rx", `${((0.5 - py) * MAX).toFixed(2)}deg`);
      card.style.setProperty("--tilt-gx", `${(px * 100).toFixed(1)}%`);
      card.style.setProperty("--tilt-gy", `${(py * 100).toFixed(1)}%`);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        try {
          tilt.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") reset();
    };

    tilt.addEventListener("pointerdown", onDown);
    tilt.addEventListener("pointermove", track);
    tilt.addEventListener("pointerup", reset);
    tilt.addEventListener("pointercancel", reset);
    tilt.addEventListener("pointerleave", onLeave);

    return () => {
      tilt.removeEventListener("pointerdown", onDown);
      tilt.removeEventListener("pointermove", track);
      tilt.removeEventListener("pointerup", reset);
      tilt.removeEventListener("pointercancel", reset);
      tilt.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={tiltRef} className="t-tilt">
      {onClick ? (
        <button
          ref={(node) => { cardRef.current = node; }}
          type="button"
          className={`t-tilt-card catalog-card tool-card${className ? ` ${className}` : ""}`}
          data-category={category}
          onClick={onClick}
        >
          {children}
          <span className="t-tilt-glare" />
        </button>
      ) : (
        <Link
          ref={(node) => { cardRef.current = node; }}
          href={href ?? "#"}
          className={`t-tilt-card catalog-card tool-card${className ? ` ${className}` : ""}`}
          data-category={category}
          transitionTypes={transitionTypes}
        >
          {children}
          <span className="t-tilt-glare" />
        </Link>
      )}
    </div>
  );
}
