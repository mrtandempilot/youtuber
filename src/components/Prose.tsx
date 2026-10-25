import type { ReactNode } from "react";

export function Prose({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-12">
      <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink">
        {children}
      </div>
    </article>
  );
}
