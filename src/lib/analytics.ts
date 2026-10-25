"use client";

type Plausible = (event: string, options?: { props?: Record<string, string | number> }) => void;

// Sends a custom event to Plausible when analytics is enabled; no-op otherwise.
export function track(event: string, props?: Record<string, string | number>) {
  const plausible = (window as unknown as { plausible?: Plausible }).plausible;
  plausible?.(event, props ? { props } : undefined);
}
