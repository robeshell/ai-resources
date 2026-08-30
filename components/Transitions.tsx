"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const SELECTED =
  '[aria-checked="true"], [aria-selected="true"], [aria-current="page"], .is-active';

export function useSlidingPill<T extends HTMLElement = HTMLDivElement>(activeKey: unknown) {
  const barRef = useRef<T>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (activeKey === undefined || !bar || !pill) return;

    const moveTo = (animate: boolean) => {
      const tab = bar.querySelector<HTMLElement>(SELECTED);
      if (!tab) return;

      const apply = () => {
        pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
        pill.style.width = `${tab.offsetWidth}px`;
        pill.style.height = `${tab.offsetHeight}px`;
      };

      if (!animate) {
        const prev = pill.style.transition;
        pill.style.transition = "none";
        apply();
        void pill.offsetWidth;
        pill.style.transition = prev;
      } else {
        apply();
      }
    };

    moveTo(mountedRef.current);
    mountedRef.current = true;

    const onResize = () => moveTo(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeKey]);

  return { barRef, pillRef };
}

export function useRovingKeys<T extends HTMLElement = HTMLElement>(barRef: { current: T | null }) {
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const itemsOf = () =>
      [...bar.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]')];

    const onKeyDown = (event: KeyboardEvent) => {
      const items = itemsOf();
      if (items.length === 0) return;
      const index = items.indexOf(event.target as HTMLElement);
      if (index < 0) return;

      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = (index + 1) % items.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = (index - 1 + items.length) % items.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = items.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      items[next].focus();
      items[next].click();
    };

    bar.addEventListener("keydown", onKeyDown);
    return () => bar.removeEventListener("keydown", onKeyDown);
  }, [barRef]);
}

export function TextSwap({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || displayed.current === value) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = value;
      displayed.current = value;
      return;
    }

    const dur =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--text-swap-dur"),
      ) || 150;

    el.classList.add("is-exit");
    const timer = window.setTimeout(() => {
      el.textContent = value;
      displayed.current = value;
      el.classList.remove("is-exit");
      el.classList.add("is-enter-start");
      void el.offsetHeight;
      el.classList.remove("is-enter-start");
    }, dur);

    return () => {
      window.clearTimeout(timer);
      el.classList.remove("is-exit", "is-enter-start");
      el.textContent = value;
      displayed.current = value;
    };
  }, [value]);

  return (
    <span ref={ref} className={["t-text-swap", className].filter(Boolean).join(" ")}>
      {value}
    </span>
  );
}

export function StaggerReveal({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "header";
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => el.classList.add("is-shown"));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={["t-stagger", className].filter(Boolean).join(" ")}
    >
      {children}
    </Tag>
  );
}

export function LearnChevron() {
  return (
    <span className="t-learn-chevron" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path className="t-learn-arm t-learn-arm-top" d="M6 4L10 8" stroke="currentColor" strokeWidth="1.5" />
        <path className="t-learn-arm t-learn-arm-bot" d="M10 8L6 12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </span>
  );
}

const NO_SUBSCRIBE = () => () => undefined;

export function useMounted(): boolean {
  return useSyncExternalStore(NO_SUBSCRIBE, () => true, () => false);
}

export function useRootDataset(name: string): string | undefined {
  const subscribe = useCallback((notify: () => void) => {
    const observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: [`data-${name}`] });
    return () => observer.disconnect();
  }, [name]);

  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute(`data-${name}`) ?? undefined,
    () => undefined,
  );
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", notify);
    return () => list.removeEventListener("change", notify);
  }, [query]);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
