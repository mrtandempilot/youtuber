"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { AnalyzedVideo, ChannelStats, VideoIssue } from "@/lib/channel-analysis";
import type { Channel, ChannelAnalytics } from "@/lib/youtube-api";
import { ApplyPanel } from "./analyzer/ApplyPanel";
import { ChannelSettingsPanel } from "./analyzer/ChannelSettingsPanel";
import { Bars, Card, Chips, fmt, pct, ScoreBadge, Stat, SuggestionView } from "./analyzer/parts";

type Report = {
  mine: boolean;
  channel: Channel;
  stats: ChannelStats;
  analytics: Omit<ChannelAnalytics, "byVideo"> | null;
  videos: AnalyzedVideo[];
  context: string;
};

type Me = { googleConfigured: boolean; connected: boolean; channel: { id: string; title: string; thumbnail: string | null } | null };

const ISSUE_LABELS: Record<VideoIssue, string> = {
  no_tags: "No tags",
  few_tags: "Few tags",
  short_description: "Short description",
  no_hashtags: "No hashtags",
  long_title: "Title over 70 chars",
  short_title: "Very short title",
  no_links_or_timestamps: "No chapters/links",
};

const OAUTH_ERRORS: Record<string, string> = {
  denied: "Google sign-in was cancelled.",
  state: "The sign-in link expired. Please try again.",
  scope: "Please allow YouTube access on the Google screen to connect your channel.",
  no_channel: "That Google account doesn't have a YouTube channel. Try another account.",
  oauth: "Couldn't connect to Google. Please try again.",
  not_configured: "Connecting channels isn't available yet. You can still analyze any public channel below.",
};

const SOURCE_LABELS: Record<string, string> = {
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

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

export function ChannelAnalyzer() {
  const [me, setMe] = useState<Me | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function analyze(body: { mine: true } | { channel: string }) {
    setLoading(true);
    setError(null);
    try {
      const r = await post<Report>("/api/youtube/analyze", body);
      setReport(r);
      track("Channel Analyzed", { mine: r.mine ? "yes" : "no" });
      setTimeout(() => document.getElementById("report")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    const justConnected = params.get("connected") === "1";
    // Deep links from the onboarding wizard: ?auto=mine or ?channel=<id|@handle>
    const auto = params.get("auto");
    const channelParam = params.get("channel");
    if (oauthError || justConnected || auto || channelParam) window.history.replaceState(null, "", window.location.pathname);

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((m: Me) => {
        setMe(m);
        if (oauthError) setError(OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS.oauth);
        else if ((justConnected || auto === "mine") && m.connected) {
          if (justConnected) track("Channel Connected");
          void analyze({ mine: true });
        } else if (channelParam) {
          setInput(channelParam);
          void analyze({ channel: channelParam });
        }
      })
      .catch(() => setMe({ googleConfigured: false, connected: false, channel: null }));
  }, []);

  async function disconnect() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe((m) => (m ? { ...m, connected: false, channel: null } : m));
    if (report?.mine) setReport(null);
  }

  return (
    <div>
      {/* Connect own channel */}
      <div className="rounded-xl border border-line bg-bg p-4">
        {me?.connected && me.channel ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {me.channel.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.channel.thumbnail} alt="" className="h-10 w-10 rounded-full" />
              )}
              <div>
                <p className="text-xs text-muted">Connected channel</p>
                <p className="font-semibold">{me.channel.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => analyze({ mine: true })}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Analyzing…" : "Analyze my channel"}
              </button>
              <button type="button" onClick={disconnect} className="rounded-xl border border-line px-3 py-2 text-sm hover:border-ink">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Your own channel</p>
              <p className="text-sm text-muted">Adds private analytics: watch time, traffic sources and real search terms.</p>
            </div>
            <a
              href="/api/auth/google"
              aria-disabled={me ? !me.googleConfigured : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-ink ${
                me && !me.googleConfigured ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <GoogleIcon /> Connect with Google
            </a>
          </div>
        )}
      </div>

      {/* Any public channel */}
      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or analyze any public channel <span className="h-px flex-1 bg-line" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) void analyze({ channel: input });
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="channel" className="sr-only">Channel link or @handle</label>
        <input
          id="channel"
          type="text"
          autoComplete="off"
          placeholder="@handle or youtube.com/@channel link"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-ink px-5 py-3 font-semibold text-bg hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}

      {report && <ReportView report={report} />}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const { channel, stats, analytics, videos, context } = report;
  const [tab, setTab] = useState<"overview" | "videos" | "channel" | "new">("overview");

  return (
    <div id="report" className="mt-8 scroll-mt-20 space-y-5" aria-live="polite">
      {/* Channel header */}
      <div className="flex items-center gap-4">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-14 w-14 rounded-full" />
        )}
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-bold">{channel.title}</h2>
          <p className="text-sm text-muted">
            {channel.handle} · {stats.sampleSize} recent videos analyzed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Subscribers" value={fmt(channel.subscribers)} />
        <Stat label="Median views / day" value={fmt(stats.medianViewsPerDay)} hint="per recent video" />
        <Stat label="Uploads / week" value={stats.uploadsPerWeek?.toString() ?? "—"} hint={`last upload ${stats.daysSinceLastUpload ?? "—"}d ago`} />
        <Stat label="Engagement" value={pct(stats.avgEngagementRate)} hint="(likes + comments) / views" />
      </div>

      <div role="tablist" className="flex gap-1 rounded-xl border border-line bg-bg p-1 text-sm">
        {(
          [
            ["overview", "Overview"],
            ["videos", "Fix old videos"],
            ["channel", "Channel settings"],
            ["new", "Plan a new video"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${tab === id ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview report={report} />}
      {tab === "videos" && <VideoList videos={videos} context={context} mine={report.mine} />}
      {tab === "channel" && <ChannelSettingsPanel channel={channel} videos={videos} context={context} mine={report.mine} />}
      {tab === "new" && <NewVideo context={context} hasShorts={stats.format.shorts.videos > 0} />}

      {!report.mine && (
        <p className="text-xs text-muted">
          Public data only. Connect your own channel to add watch time, traffic sources and real search terms.
        </p>
      )}
      {analytics === null && report.mine && (
        <p className="text-xs text-muted">Private analytics weren&apos;t available for this channel; public stats are shown.</p>
      )}
    </div>
  );
}

function Overview({ report }: { report: Report }) {
  const { stats, analytics, context } = report;
  const [audit, setAudit] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ result: Record<string, unknown> }>("/api/youtube/suggest", { mode: "audit", context });
      setAudit(r.result);
      track("Channel Audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const issues = (Object.entries(stats.issueCounts) as [VideoIssue, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <Card
        title="AI channel audit"
        subtitle="Strengths, problems, a prioritized action list and new video ideas."
        action={
          !audit && (
            <button
              type="button"
              disabled={loading}
              onClick={runAudit}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Thinking…" : "Run AI audit"}
            </button>
          )
        }
      >
        {error && <p className="text-sm text-accent">{error}</p>}
        {audit ? <AuditView audit={audit} /> : !error && <p className="text-sm text-muted">Takes about 10 seconds.</p>}
      </Card>

      {analytics && (
        <Card title={`Last ${analytics.periodDays} days`} subtitle="Private YouTube Analytics for your channel.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Views" value={fmt(analytics.totals.views)} />
            <Stat label="Watch time (hours)" value={fmt(analytics.totals.minutesWatched / 60)} />
            <Stat label="Avg. view duration" value={`${Math.round(analytics.totals.avgViewDurationSec)}s`} />
            <Stat label="Subscribers gained" value={fmt(analytics.totals.subscribersGained)} />
          </div>
          {analytics.trafficSources.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold">Where views come from</h4>
              <Bars
                unit=""
                showCount={false}
                wideLabels
                buckets={analytics.trafficSources.slice(0, 6).map((s) => ({
                  label: SOURCE_LABELS[s.source] ?? s.source,
                  videos: 0,
                  medianScore: s.views,
                }))}
              />
            </div>
          )}
          {analytics.topSearchTerms.length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-sm font-semibold">Real search terms viewers used to find you</h4>
              <Chips items={analytics.topSearchTerms.slice(0, 20).map((t) => t.term)} />
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Best videos" subtitle="Score = views/day vs. your median">
          <MiniList videos={stats.top} />
        </Card>
        <Card title="Needs work" subtitle="Candidates for new titles, thumbnails and tags">
          {stats.underperformers.length ? <MiniList videos={stats.underperformers} /> : <p className="text-sm text-muted">No clear underperformers. Nice.</p>}
        </Card>
      </div>

      <Card title="Tags & hashtags that work" subtitle="Used on 2+ videos; median score of those videos">
        {stats.topTags.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {stats.topTags.map((t) => (
              <li key={t.tag} className="rounded-md bg-accent-soft px-2 py-0.5 text-sm text-accent">
                {t.tag} <span className="font-mono text-xs opacity-70">{t.medianScore}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Not enough repeated tags to compare. Most videos use different or no tags.</p>
        )}
        {stats.topHashtags.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">Hashtags</h4>
            <Chips items={stats.topHashtags.map((t) => `${t.tag} ${t.medianScore}×`)} />
          </div>
        )}
        {stats.weakTags.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold">Tags linked to weaker videos</h4>
            <Chips tone="muted" items={stats.weakTags.map((t) => `${t.tag} ${t.medianScore}×`)} />
          </div>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Best upload day" subtitle="Median score by weekday (UTC)">
          <Bars buckets={stats.byWeekday} />
        </Card>
        <Card title="Best upload time" subtitle="Median score by hour (UTC)">
          <Bars buckets={stats.byHour} />
        </Card>
        <Card title="Title length" subtitle="Median score by characters">
          <Bars buckets={stats.titleLength} />
        </Card>
        <Card title="Shorts vs long videos" subtitle="Median views per day">
          <Bars unit="" wideLabels buckets={[stats.format.shorts, stats.format.long].filter((b) => b.videos > 0)} />
        </Card>
      </div>

      {issues.length > 0 && (
        <Card title="Quick SEO fixes" subtitle={`Across your last ${stats.sampleSize} videos`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {issues.map(([k, n]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                {ISSUE_LABELS[k]}
                <span className="font-mono text-xs text-muted">{n} videos</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function AuditView({ audit }: { audit: Record<string, unknown> }) {
  const list = (k: string) => (Array.isArray(audit[k]) ? (audit[k] as unknown[]) : []);
  const text = (x: unknown) => (typeof x === "string" ? x : "");
  return (
    <div className="space-y-5 text-sm">
      {text(audit.summary) && <p className="text-base leading-relaxed">{text(audit.summary)}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 font-semibold">Strengths</h4>
          <ul className="list-disc space-y-1 pl-5">{list("strengths").map((s, i) => <li key={i}>{text(s)}</li>)}</ul>
        </div>
        <div>
          <h4 className="mb-2 font-semibold">Problems</h4>
          <ul className="list-disc space-y-1 pl-5">{list("problems").map((s, i) => <li key={i}>{text(s)}</li>)}</ul>
        </div>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Do this next</h4>
        <ol className="space-y-3">
          {list("actions").map((a, i) => {
            const o = (a ?? {}) as Record<string, unknown>;
            return (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">{i + 1}</span>
                <div>
                  <p className="font-semibold">{text(o.title)}</p>
                  <p className="text-muted">{text(o.why)}</p>
                  {text(o.how) && <p className="mt-1">{text(o.how)}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {list("contentIdeas").length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold">Video ideas from your data</h4>
          <ul className="space-y-2">
            {list("contentIdeas").map((c, i) => {
              const o = (c ?? {}) as Record<string, unknown>;
              return (
                <li key={i} className="rounded-lg border border-line px-3 py-2">
                  <p className="font-medium">{text(o.title)}</p>
                  <p className="text-xs text-muted">{text(o.why)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function MiniList({ videos }: { videos: AnalyzedVideo[] }) {
  return (
    <ul className="space-y-3">
      {videos.map((v) => (
        <li key={v.id} className="flex items-center gap-3">
          {v.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnail} alt="" loading="lazy" className="h-10 w-16 shrink-0 rounded-md object-cover" />
          )}
          <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" className="line-clamp-2 flex-1 text-sm hover:underline">
            {v.title}
          </a>
          <ScoreBadge score={v.score} />
        </li>
      ))}
    </ul>
  );
}

function VideoList({ videos, context, mine }: { videos: AnalyzedVideo[]; context: string; mine: boolean }) {
  const [sort, setSort] = useState<"weakest" | "newest" | "best">("weakest");
  const [open, setOpen] = useState<string | null>(null);

  const sorted = [...videos].sort((a, b) => {
    if (sort === "newest") return b.publishedAt.localeCompare(a.publishedAt);
    const sa = a.score ?? (sort === "weakest" ? 99 : -1);
    const sb = b.score ?? (sort === "weakest" ? 99 : -1);
    return sort === "weakest" ? sa - sb : sb - sa;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Open a video to get AI titles, description, tags and hashtags.</p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-sm"
          aria-label="Sort videos"
        >
          <option value="weakest">Weakest first</option>
          <option value="best">Best first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>
      <ul className="space-y-2">
        {sorted.map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setOpen(open === v.id ? null : v.id)}
              aria-expanded={open === v.id}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              {v.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" loading="lazy" className="h-12 w-20 shrink-0 rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{v.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {fmt(v.views)} views · {Math.round(v.ageDays)}d ago · {v.isShort ? "Short" : "Video"}
                  {v.analytics ? ` · ${Math.round(v.analytics.avgViewPercentage)}% viewed` : ""}
                  {v.issues.length ? ` · ${v.issues.length} issue${v.issues.length > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <ScoreBadge score={v.score} />
            </button>
            {open === v.id && <ImprovePanel video={v} context={context} mine={mine} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImprovePanel({ video, context, mine }: { video: AnalyzedVideo; context: string; mine: boolean }) {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(video.tags);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ result: Record<string, unknown> }>("/api/youtube/suggest", {
        mode: "improve",
        context,
        video: { title: video.title, description: video.description, tags: video.tags, score: video.score, views: video.views, isShort: video.isShort },
      });
      setResult(r.result);
      track("Video Improved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-line p-4">
      {video.issues.length > 0 && <Chips tone="muted" items={video.issues.map((i) => ISSUE_LABELS[i])} />}
      <div className="text-sm">
        <p className="mb-1 font-semibold">Current tags</p>
        <p className="text-muted">{showTags.length ? showTags.join(", ") : "None"}</p>
      </div>
      {!result && (
        <button
          type="button"
          disabled={loading}
          onClick={run}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Improving…" : "Improve with AI"}
        </button>
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
      {result && <ApplyPanel videoId={video.id} result={result} mine={mine} onApplied={(m) => setShowTags(m.tags)} />}
      {result && <SuggestionView result={result} />}
    </div>
  );
}

function NewVideo({ context, hasShorts }: { context: string; hasShorts: boolean }) {
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState<"long" | "short">("long");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ result: Record<string, unknown> }>("/api/youtube/suggest", { mode: "new", context, topic, notes, format });
      setResult(r.result);
      track("New Video Planned", { format });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Plan a new video" subtitle="Titles, description, tags and hashtags tuned to what already works on this channel.">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="nv-topic" className="mb-1 block text-sm font-medium">What is the video about?</label>
          <input
            id="nv-topic"
            value={topic}
            maxLength={300}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Testing the cheapest budget mic vs a $300 mic"
            className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-accent"
          />
        </div>
        <div>
          <label htmlFor="nv-notes" className="mb-1 block text-sm font-medium">Notes (optional)</label>
          <textarea
            id="nv-notes"
            rows={2}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Key points, products, target audience…"
            className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["long", "short"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              aria-pressed={format === f}
              className={`rounded-full border px-4 py-1.5 text-sm ${format === f ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"}`}
            >
              {f === "long" ? "Long video" : "Short"}
            </button>
          ))}
          {!hasShorts && format === "short" && <span className="text-xs text-muted">No Shorts on this channel yet.</span>}
        </div>
        <button
          type="submit"
          disabled={loading || topic.trim().length < 3}
          className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Writing…" : "Generate SEO package"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      {result && (
        <div className="mt-6 border-t border-line pt-5">
          <SuggestionView result={result} />
        </div>
      )}
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
