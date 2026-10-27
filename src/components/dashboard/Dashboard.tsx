"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { Dashboard as DashboardData } from "@/lib/youtube-api";
import { BarChart, LineChart, ShareList, type Point } from "./Charts";

type Change = {
  id: string;
  kind: "video" | "channel" | "undo";
  videoId: string | null;
  title: string | null;
  previousTitle: string | null;
  fields: string[];
  createdAt: string;
  impact: { beforePerDay: number | null; afterPerDay: number | null; afterDaysCounted: number } | null;
};

type Data = DashboardData & {
  channel: { id: string; title: string; thumbnail: string | null; subscribers: number | null; views: number; videoCount: number };
  changes: Change[];
};

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
];

const SOURCES: Record<string, string> = {
  YT_SEARCH: "YouTube search",
  SUBSCRIBER: "Browse / home",
  RELATED_VIDEO: "Suggested videos",
  SHORTS: "Shorts feed",
  EXT_URL: "External sites",
  YT_CHANNEL: "Channel pages",
  PLAYLIST: "Playlists",
  NO_LINK_OTHER: "Direct / unknown",
  NOTIFICATION: "Notifications",
  YT_OTHER_PAGE: "Other YouTube pages",
  END_SCREEN: "End screens",
  HASHTAGS: "Hashtag pages",
};
const DEVICES: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Desktop", TV: "TV", TABLET: "Tablet", GAME_CONSOLE: "Console" };

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  description: "description",
  tags: "tags",
  keywords: "keywords",
  unsubscribedTrailer: "channel trailer",
  country: "country",
  defaultLanguage: "language",
};

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

// Daily for short ranges; weekly sums for 12 months so bars stay readable.
function bucket(series: DashboardData["series"], pick: (p: DashboardData["series"][number]) => number): Point[] {
  if (series.length <= 90) return series.map((p) => ({ label: shortDate(p.day), value: pick(p) }));
  const out: Point[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    out.push({ label: shortDate(chunk[0].day), value: chunk.reduce((a, p) => a + pick(p), 0) });
  }
  return out;
}

function Delta({ now, before, invert = false }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span className="text-xs text-muted">no previous data</span>;
  const pct = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-xs text-muted">same as previous</span>;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600 dark:text-emerald-400" : "text-accent"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}% <span className="font-normal text-muted">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, now, before, suffix = "" }: { label: string; value: string; now: number; before: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold tracking-tight">
        {value}
        {suffix && <span className="ml-0.5 text-base font-medium text-muted">{suffix}</span>}
      </p>
      <div className="mt-1">
        <Delta now={now} before={before} />
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DataTable({ rows, unit }: { rows: Point[]; unit: string }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted hover:text-ink">Show as table</summary>
      <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-line">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-bg text-xs text-muted">
            <tr>
              <th className="px-3 py-1.5 font-medium">Date</th>
              <th className="px-3 py-1.5 text-right font-medium">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="px-3 py-1">{r.label}</td>
                <td className="px-3 py-1 text-right font-mono">{r.value.toLocaleString("en")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ImpactBadge({ impact }: { impact: Change["impact"] }) {
  if (!impact || impact.beforePerDay == null) return <span className="text-xs text-muted">—</span>;
  if (impact.afterPerDay == null)
    return <span className="text-xs text-muted">measuring… ({impact.afterDaysCounted}/3 days)</span>;
  const diff = impact.beforePerDay ? ((impact.afterPerDay - impact.beforePerDay) / impact.beforePerDay) * 100 : null;
  const good = impact.afterPerDay >= impact.beforePerDay;
  return (
    <span className="text-right text-xs">
      <span className="font-mono">
        {impact.beforePerDay} → {impact.afterPerDay}
      </span>{" "}
      <span className="text-muted">views/day</span>
      {diff != null && (
        <span className={`ml-1.5 font-semibold ${good ? "text-emerald-600 dark:text-emerald-400" : "text-accent"}`}>
          {good ? "+" : ""}
          {Math.round(diff)}%
        </span>
      )}
    </span>
  );
}

export function Dashboard() {
  const [days, setDays] = useState(28);
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Only sets state after the request resolves (the click handler shows the refreshing state).
  const load = useCallback(async (d: number) => {
    try {
      const res = await fetch(`/api/dashboard?days=${d}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return setState("signed-out");
      if (!res.ok) {
        setError(json.error ?? "Couldn't load your dashboard.");
        return setState("error");
      }
      setData(json as Data);
      setState("ready");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial load; later loads happen in the period buttons' click handler.
    void load(28);
    track("Dashboard Viewed");
  }, [load]);

  if (state === "signed-out") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center">
        <h2 className="font-display text-2xl font-bold">Connect your channel</h2>
        <p className="mt-2 text-muted">
          Your growth dashboard uses your private YouTube Analytics — views, watch time and subscribers over time.
        </p>
        <a
          href="/api/auth/google?next=/youtube-channel-analyzer"
          className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90"
        >
          Connect with Google
        </a>
      </div>
    );
  }
  if (state === "error") return <p className="text-accent">{error}</p>;
  if (!data) return <p className="text-muted">Loading your channel…</p>;

  const views = bucket(data.series, (p) => p.views);
  const subs = bucket(data.series, (p) => p.subsGained - p.subsLost);
  const unitLabel = data.series.length > 90 ? "per week" : "per day";

  return (
    <div className={`space-y-6 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {data.channel.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.channel.thumbnail} alt="" className="h-12 w-12 rounded-full" />
          )}
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">{data.channel.title}</h1>
            <p className="text-sm text-muted">
              {compact(data.channel.subscribers ?? 0)} subscribers · {compact(data.channel.views)} total views ·{" "}
              {data.channel.videoCount} videos
            </p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Period" className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              role="radio"
              aria-checked={days === p.days}
              onClick={() => {
                setDays(p.days);
                setRefreshing(true);
                void load(p.days);
              }}
              className={`rounded-lg px-3 py-1.5 ${days === p.days ? "bg-ink font-medium text-bg" : "text-muted hover:text-ink"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted">
        {shortDate(data.range.start)} – {shortDate(data.range.end)} · compared with the {data.days} days before · YouTube
        Analytics can lag up to 48 hours
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Views" value={compact(data.current.views)} now={data.current.views} before={data.previous.views} />
        <Kpi label="Watch time" value={compact(data.current.watchHours)} suffix="h" now={data.current.watchHours} before={data.previous.watchHours} />
        <Kpi
          label="Net subscribers"
          value={`${data.current.netSubs >= 0 ? "+" : ""}${compact(data.current.netSubs)}`}
          now={data.current.netSubs}
          before={data.previous.netSubs}
        />
        <Kpi
          label="Avg. view duration"
          value={`${Math.floor(data.current.avgViewDurationSec / 60)}:${String(data.current.avgViewDurationSec % 60).padStart(2, "0")}`}
          now={data.current.avgViewDurationSec}
          before={data.previous.avgViewDurationSec}
        />
      </div>

      <Panel title="Views" subtitle={`Views ${unitLabel}`}>
        <LineChart data={views} unit={`views ${unitLabel}`} ariaLabel={`Views ${unitLabel}, last ${data.days} days`} />
        <DataTable rows={views} unit="Views" />
      </Panel>

      <Panel title="Net subscribers" subtitle={`Gained minus lost, ${unitLabel}`}>
        <BarChart data={subs} unit={`net subscribers ${unitLabel}`} ariaLabel={`Net subscribers ${unitLabel}`} />
        <DataTable rows={subs} unit="Net subscribers" />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Where views come from">
          <ShareList rows={data.trafficSources.slice(0, 6).map((s) => ({ label: SOURCES[s.source] ?? s.source, value: s.views }))} />
        </Panel>
        <Panel title="Top countries">
          <ShareList rows={data.countries.slice(0, 6).map((c) => ({ label: regionName(c.country), value: c.views }))} />
        </Panel>
        <Panel title="Devices">
          <ShareList rows={data.devices.map((d) => ({ label: DEVICES[d.device] ?? d.device, value: d.views }))} />
        </Panel>
      </div>

      <Panel title="Top videos this period">
        {data.topVideos.length ? (
          <ol className="divide-y divide-line">
            {data.topVideos.map((v, i) => (
              <li key={v.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded-md object-cover" />
                )}
                <a
                  href={`https://www.youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-1 flex-1 text-sm hover:underline"
                >
                  {v.title}
                </a>
                <span className="hidden font-mono text-xs text-muted sm:inline">{compact(v.watchHours)}h</span>
                <span className="w-16 text-right font-mono text-sm">{compact(v.views)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No views in this period yet.</p>
        )}
      </Panel>

      <Panel title="Impact of your changes" subtitle="Average daily views of the video 7 days before vs after each change made with CreatorKit.">
        {data.changes.length ? (
          <ul className="divide-y divide-line">
            {data.changes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-medium">
                    {c.kind === "channel" ? "Channel settings" : c.kind === "undo" ? `Undo: ${c.title ?? c.videoId}` : (c.title ?? c.videoId)}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(c.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })} · changed{" "}
                    {c.fields.map((f) => FIELD_LABELS[f] ?? f).join(", ") || "nothing"}
                  </p>
                </div>
                {c.kind === "video" ? <ImpactBadge impact={c.impact} /> : <span className="text-xs text-muted">—</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-muted">
            <p>No changes yet. Improve a video and click “Apply to YouTube” — its before/after shows up here.</p>
            <Link href="/youtube-channel-analyzer?auto=mine" className="mt-3 inline-block rounded-lg bg-ink px-3 py-1.5 font-medium text-bg">
              Fix my videos
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}
