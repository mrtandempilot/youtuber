"use client";

import { useState, type ReactNode } from "react";
import type { Bucket } from "@/lib/channel-analysis";

export const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const pct = (n: number | null | undefined) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">new</span>;
  const cls =
    score >= 1.5 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : score >= 0.8 ? "bg-line text-ink" : "bg-accent-soft text-accent";
  return <span className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${cls}`}>{score.toFixed(1)}×</span>;
}

// Horizontal bars for buckets; the best bucket is highlighted.
export function Bars({
  buckets,
  unit = "×",
  showCount = true,
  wideLabels = false,
}: {
  buckets: Bucket[];
  unit?: string;
  showCount?: boolean;
  wideLabels?: boolean;
}) {
  if (!buckets.length) return <p className="text-sm text-muted">Not enough data yet.</p>;
  const max = Math.max(...buckets.map((b) => b.medianScore), 0.01);
  const best = buckets.reduce((a, b) => (b.medianScore > a.medianScore && (!showCount || b.videos >= 2) ? b : a), buckets[0]);
  return (
    <ul className="space-y-2">
      {buckets.map((b) => (
        <li
          key={b.label}
          className={`grid items-center gap-3 text-sm ${wideLabels ? "grid-cols-[8.5rem_1fr_auto]" : "grid-cols-[4.5rem_1fr_auto]"}`}
        >
          <span className="truncate text-muted">{b.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full rounded-full ${b === best ? "bg-accent" : "bg-muted/50"}`}
              style={{ width: `${(b.medianScore / max) * 100}%` }}
            />
          </span>
          <span className="w-24 text-right font-mono text-xs">
            {unit ? `${b.medianScore}${unit}` : fmt(b.medianScore)}
            {showCount && <span className="text-muted"> · {b.videos}v</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="shrink-0 rounded-lg border border-line px-2.5 py-1 text-xs hover:border-ink"
    >
      {done ? "Copied!" : label}
    </button>
  );
}

export function Chips({ items, tone = "accent" }: { items: string[]; tone?: "accent" | "muted" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span
          key={t}
          className={`rounded-md px-2 py-0.5 text-sm ${tone === "accent" ? "bg-accent-soft text-accent" : "bg-line text-muted"}`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Renders an AI suggestion package (improve / new video) with copy buttons.
export function SuggestionView({ result }: { result: Record<string, unknown> }) {
  const titles = asStrings(result.titles);
  const tags = asStrings(result.tags);
  const hashtags = asStrings(result.hashtags);
  const keywords = asStrings(result.keywords);
  const thumb = asStrings(result.thumbnailText);
  const diagnosis = asStrings(result.diagnosis);
  const description = typeof result.description === "string" ? result.description : "";
  const hook = typeof result.hook === "string" ? result.hook : "";

  return (
    <div className="space-y-5">
      {diagnosis.length > 0 && (
        <Block title="What's holding it back">
          <ul className="list-disc space-y-1 pl-5 text-sm">{diagnosis.map((d) => <li key={d}>{d}</li>)}</ul>
        </Block>
      )}
      {titles.length > 0 && (
        <Block title="Titles">
          <ul className="space-y-2">
            {titles.map((t) => (
              <li key={t} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                <span>
                  {t} <span className="text-xs text-muted">({t.length})</span>
                </span>
                <CopyButton text={t} />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {description && (
        <Block title="Description" action={<CopyButton text={description} />}>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg p-3 font-sans text-sm">{description}</pre>
        </Block>
      )}
      {tags.length > 0 && (
        <Block title={`Tags (${tags.join(",").length}/500 chars)`} action={<CopyButton text={tags.join(", ")} />}>
          <Chips items={tags} tone="muted" />
        </Block>
      )}
      {hashtags.length > 0 && (
        <Block title="Hashtags" action={<CopyButton text={hashtags.join(" ")} />}>
          <Chips items={hashtags} />
        </Block>
      )}
      {keywords.length > 0 && (
        <Block title="Target keywords">
          <Chips items={keywords} tone="muted" />
        </Block>
      )}
      {thumb.length > 0 && (
        <Block title="Thumbnail text ideas">
          <Chips items={thumb} tone="muted" />
        </Block>
      )}
      {hook && (
        <Block title="Opening hook">
          <p className="text-sm">{hook}</p>
        </Block>
      )}
    </div>
  );
}

function Block({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}
