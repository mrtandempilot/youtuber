"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_KEY, ACCENTS, THEME_KEY, THEMES, type Accent, type Theme } from "@/lib/theme";

const THEME_LABELS: Record<Theme, string> = { light: "Light", dark: "Dark", auto: "Auto" };
const ACCENT_LABELS: Record<Accent, string> = { orange: "Orange", blue: "Blue", green: "Green", purple: "Purple" };
// Swatches show the light-mode accent of each option.
const SWATCH: Record<Accent, string> = { orange: "#ff4a1c", blue: "#2563eb", green: "#15803d", purple: "#7c3aed" };

function readAttr<T extends string>(name: "theme" | "accent", allowed: readonly T[], fallback: T): T {
  const v = document.documentElement.dataset[name] as T | undefined;
  return v && allowed.includes(v) ? v : fallback;
}

function apply(name: "theme" | "accent", key: string, value: string) {
  document.documentElement.dataset[name] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the choice still applies for this visit */
  }
}

// Appearance menu: light / dark / auto + accent color. Persists per browser.
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  // Defaults match the server render; the real values are read from <html> when the menu opens.
  const [theme, setTheme] = useState<Theme>("light");
  const [accent, setAccent] = useState<Accent>("orange");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function chooseTheme(t: Theme) {
    apply("theme", THEME_KEY, t);
    setTheme(t);
  }
  function chooseAccent(a: Accent) {
    apply("accent", ACCENT_KEY, a);
    setAccent(a);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Appearance"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setTheme(readAttr("theme", THEMES, "light"));
            setAccent(readAttr("accent", ACCENTS, "orange"));
          }
          setOpen(!open);
        }}
        className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted hover:border-ink hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className="absolute right-0 top-10 z-30 w-56 rounded-2xl border border-line bg-surface p-3 shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Appearance</p>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1 text-sm">
            {THEMES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={theme === t}
                onClick={() => chooseTheme(t)}
                className={`rounded-lg py-1.5 ${theme === t ? "bg-surface font-semibold shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">Color</p>
          <div role="radiogroup" aria-label="Accent color" className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={accent === a}
                aria-label={ACCENT_LABELS[a]}
                title={ACCENT_LABELS[a]}
                onClick={() => chooseAccent(a)}
                className={`grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-surface ${accent === a ? "ring-2 ring-ink" : ""}`}
                style={{ background: SWATCH[a] }}
              >
                {accent === a && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
