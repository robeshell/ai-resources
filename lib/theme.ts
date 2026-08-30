export const THEME_STORAGE_KEY = "ai-nav-theme";
export const ACCENT_STORAGE_KEY = "ai-nav-accent";

export const ACCENTS = ["orange", "purple", "blue", "teal", "rose"] as const;

export type Theme = "light" | "dark";
export type Accent = (typeof ACCENTS)[number];

export const DEFAULT_THEME: Theme = "light";
export const DEFAULT_ACCENT: Accent = "orange";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function isAccent(value: unknown): value is Accent {
  return ACCENTS.includes(value as Accent);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = accent;
}

export const THEME_BOOTSTRAP = `(function(){try{var r=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var a=localStorage.getItem("${ACCENT_STORAGE_KEY}");var ok=${JSON.stringify([...ACCENTS])};if(ok.indexOf(a)<0)a="${DEFAULT_ACCENT}";r.setAttribute("data-theme",t);r.setAttribute("data-accent",a);r.style.colorScheme=t;var m=location.pathname.match(/\\/(en|zh)(?=\\/|$)/);r.setAttribute("lang",m&&m[1]==="zh"?"zh-CN":"en");}catch(e){}})();`;
