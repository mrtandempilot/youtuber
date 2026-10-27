export const THEMES = ["light", "dark", "auto"] as const;
export const ACCENTS = ["orange", "blue", "green", "purple"] as const;
export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];

export const THEME_KEY = "ck-theme";
export const ACCENT_KEY = "ck-accent";

// Runs in <head> before first paint so a saved theme never flashes the default.
export const themeBootScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_KEY}");var a=localStorage.getItem("${ACCENT_KEY}");if(${JSON.stringify(THEMES)}.indexOf(t)>-1)d.dataset.theme=t;if(${JSON.stringify(ACCENTS)}.indexOf(a)>-1)d.dataset.accent=a;}catch(e){}})();`;
