"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { ChannelStats } from "@/lib/channel-analysis";
import type { Channel } from "@/lib/youtube-api";
import { fmt, Stat } from "@/components/tools/analyzer/parts";

// Onboarding wizard: channel → goals → (auto analysis) → personal 4-week plan.
// Analysis starts in the background as soon as the channel is known, so step 3 feels instant.

type Me = {
  googleConfigured: boolean;
  connected: boolean;
  account?: boolean;
  email?: string | null;
  channel: { id: string; title: string; thumbnail: string | null } | null;
};
type Report = { mine: boolean; channel: Channel; stats: ChannelStats; context: string };
type Plan = {
  headline?: string;
  summary?: string;
  quickWins?: { title?: string; detail?: string }[];
  weeks?: { week?: number; focus?: string; videos?: { title?: string; format?: string; why?: string }[]; tasks?: string[] }[];
  habits?: string[];
};
type Answers = { goal: string; niche: string; videosPerWeek: number; format: "long" | "short" | "mixed" };
type Saved = {
  answers: Answers;
  mine: boolean;
  channel: Channel;
  stats: ChannelStats;
  plan: Plan;
  createdAt: string;
  inAccount?: boolean; // stored in the creator's account (Supabase), not just this browser
};

type DbPlan = {
  goal: string;
  niche: string | null;
  videos_per_week: number;
  format: Answers["format"];
  plan: Plan;
  stats: { stats: ChannelStats; channel: Channel } | null;
  created_at: string;
};

// Latest plan saved in the creator's account, converted to the wizard's shape.
async function loadAccountPlan(): Promise<Saved | null> {
  try {
    const r = await fetch("/api/plans", { cache: "no-store" }).then((x) => x.json());
    const p = r.plan as DbPlan | null;
    if (!p?.stats?.channel || !p.stats.stats) return null;
    return {
      answers: { goal: p.goal, niche: p.niche ?? "", videosPerWeek: p.videos_per_week, format: p.format },
      mine: true,
      channel: p.stats.channel,
      stats: p.stats.stats,
      plan: p.plan,
      createdAt: p.created_at,
      inAccount: true,
    };
  } catch {
    return null;
  }
}

// Saves a freshly made plan to the account (no-op server-side if not signed in).
async function saveToAccount(s: Saved): Promise<boolean> {
  try {
    const r = await post<{ saved: boolean }>("/api/plans", {
      ...s.answers,
      plan: s.plan,
      stats: { stats: s.stats, channel: s.channel },
    });
    return r.saved;
  } catch {
    return false;
  }
}

const STORAGE_KEY = "ck_onboarding_v1";

const GOALS = [
  { id: "views", label: "More views", hint: "Get each video seen by more people" },
  { id: "subscribers", label: "More subscribers", hint: "Turn viewers into a loyal audience" },
  { id: "monetize", label: "Get monetized", hint: "Reach 1,000 subs + 4,000 watch hours" },
  { id: "shorts", label: "Grow with Shorts", hint: "Use short-form to reach new viewers" },
  { id: "search", label: "Rank in search", hint: "Show up when people search your topic" },
];

const STEPS = ["Channel", "Goals", "Your plan"];

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(s: Saved | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the plan still shows for this visit */
  }
}

export function Wizard() {
  const [step, setStep] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [link, setLink] = useState("");
  const [answers, setAnswers] = useState<Answers>({ goal: "views", niche: "", videosPerWeek: 1, format: "mixed" });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [analysis, setAnalysis] = useState<Promise<Report> | null>(null);

  function startAnalysis(src: { mine: true } | { channel: string }) {
    const p = post<Report>("/api/youtube/analyze", src);
    p.catch(() => undefined); // handled when awaited in step 3
    setAnalysis(p);
    // Pre-fill the niche from channel keywords once data arrives.
    p.then((r) =>
      setAnswers((a) => (a.niche ? a : { ...a, niche: r.channel.keywords.slice(0, 4).join(", ") })),
    ).catch(() => undefined);
  }

  useEffect(() => {
    const existing = load();
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    const justConnected = params.get("connected") === "1";
    if (oauthError || justConnected) window.history.replaceState(null, "", window.location.pathname);

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(async (m: Me) => {
        setMe(m);
        // Signed-in creators get the plan stored in their account (works on any device).
        const fromAccount = m.account ? await loadAccountPlan() : null;
        if (oauthError) {
          setError(
            oauthError === "no_channel"
              ? "That Google account has no YouTube channel. Try another account or paste a channel link."
              : oauthError === "not_configured"
                ? "Google sign-in isn't available yet. Paste your channel link instead."
                : "Google sign-in didn't complete. Please try again or paste your channel link.",
          );
        } else if (justConnected && m.connected) {
          track("Onboarding Connected");
          if (fromAccount) {
            setSaved(fromAccount); // returning creator: show their plan
            return;
          }
          startAnalysis({ mine: true });
          setStep(1);
          return;
        }
        const local = existing && (!m.connected || existing.channel.id === m.channel?.id) ? existing : null;
        if (fromAccount || local) setSaved(fromAccount ?? local);
      })
      .catch(() => setMe({ googleConfigured: false, connected: false, channel: null }));
    // Runs once on mount.
  }, []);

  function restart() {
    save(null);
    setSaved(null);
    setStep(0);
    setError(null);
    setAnalysis(null);
  }

  // Returning visitor with a saved plan.
  if (saved && step === 0) {
    return (
      <div>
        <PlanView saved={saved} />
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={restart} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-ink">
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Progress step={step} />

      {error && step < 2 && <p role="alert" className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">{error}</p>}

      {step === 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold">Which channel should we grow?</h2>
          <p className="mt-1 text-muted">Connect it for the most accurate plan, or just paste the link.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-accent bg-surface p-5">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">Recommended</span>
              <h3 className="mt-3 font-semibold">Connect with Google</h3>
              <p className="mt-1 text-sm text-muted">
                Read-only access. Adds watch time, traffic sources and the real search terms people use to find you.
              </p>
              {me?.connected && me.channel ? (
                <button
                  type="button"
                  onClick={() => {
                    startAnalysis({ mine: true });
                    setStep(1);
                  }}
                  className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:opacity-90"
                >
                  Continue as {me.channel.title}
                </button>
              ) : (
                <a
                  href="/api/auth/google?next=/start"
                  onClick={() => track("Onboarding Google Click")}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink hover:opacity-90 ${
                    me && !me.googleConfigured ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  Connect YouTube channel
                </a>
              )}
            </div>

            <form
              className="rounded-2xl border border-line bg-surface p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (link.trim().length < 3) return setError("Paste your channel link or @handle.");
                setError(null);
                track("Onboarding Link");
                startAnalysis({ channel: link.trim() });
                setStep(1);
              }}
            >
              <h3 className="font-semibold">Paste your channel link</h3>
              <p className="mt-1 text-sm text-muted">Public data only. No sign-in needed.</p>
              <label htmlFor="wz-link" className="sr-only">Channel link or @handle</label>
              <input
                id="wz-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="@yourchannel"
                autoComplete="off"
                className="mt-4 w-full rounded-xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-accent"
              />
              <button type="submit" className="mt-3 w-full rounded-xl bg-ink px-4 py-2.5 font-semibold text-bg hover:opacity-90">
                Continue
              </button>
            </form>
          </div>
        </section>
      )}

      {step === 1 && (
        <section>
          <h2 className="font-display text-2xl font-bold">What do you want most right now?</h2>
          <p className="mt-1 text-muted">Your plan is built around one main goal. You can change it later.</p>

          <fieldset className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="sr-only">Main goal</legend>
            {GOALS.map((g) => (
              <label
                key={g.id}
                className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
                  answers.goal === g.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name="goal"
                  value={g.id}
                  checked={answers.goal === g.id}
                  onChange={() => setAnswers({ ...answers, goal: g.id })}
                  className="sr-only"
                />
                <span className="block font-semibold">{g.label}</span>
                <span className="mt-1 block text-sm text-muted">{g.hint}</span>
              </label>
            ))}
          </fieldset>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label htmlFor="wz-niche" className="mb-1 block text-sm font-medium">What is your channel about?</label>
              <input
                id="wz-niche"
                value={answers.niche}
                maxLength={200}
                onChange={(e) => setAnswers({ ...answers, niche: e.target.value })}
                placeholder="e.g. paragliding, travel in Turkey, adventure vlogs"
                className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="wz-freq" className="mb-1 block text-sm font-medium">Videos per week you can make</label>
              <select
                id="wz-freq"
                value={answers.videosPerWeek}
                onChange={(e) => setAnswers({ ...answers, videosPerWeek: Number(e.target.value) })}
                className="w-full rounded-xl border border-line bg-bg px-4 py-2.5"
              >
                {[1, 2, 3, 5, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="md:col-span-2">
              <legend className="mb-1 block text-sm font-medium">Format</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["mixed", "Both"],
                    ["long", "Long videos"],
                    ["short", "Shorts"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={answers.format === id}
                    onClick={() => setAnswers({ ...answers, format: id })}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      answers.format === id ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-8 flex justify-between gap-3">
            <button type="button" onClick={() => setStep(0)} className="rounded-xl border border-line px-4 py-2.5 text-sm hover:border-ink">
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                track("Onboarding Goal", { goal: answers.goal });
                setStep(2);
              }}
              className="rounded-xl bg-accent px-6 py-2.5 font-semibold text-accent-ink hover:opacity-90"
            >
              Build my plan →
            </button>
          </div>
        </section>
      )}

      {step === 2 && analysis && (
        <Building
          analysis={analysis}
          answers={answers}
          onDone={(s) => {
            save(s);
            setSaved(s);
            if (s.mine) {
              void saveToAccount(s).then((ok) => {
                if (ok) setSaved((cur) => (cur === s ? { ...s, inAccount: true } : cur));
              });
            }
            setStep(3);
            track("Onboarding Complete", { goal: answers.goal });
          }}
          onBack={() => setStep(0)}
        />
      )}

      {step === 3 && saved && (
        <div>
          <PlanView saved={saved} />
          <div className="mt-8">
            <button type="button" onClick={restart} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-ink">
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Progress({ step }: { step: number }) {
  const current = Math.min(step, 2);
  return (
    <ol className="mb-8 flex items-center gap-2 text-sm" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
              i < current ? "bg-ink text-bg" : i === current ? "bg-accent text-accent-ink" : "bg-line text-muted"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </span>
          <span className={i === current ? "font-medium" : "text-muted"}>{label}</span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

const BUILD_STEPS = [
  "Reading your channel",
  "Scoring your last 50 videos",
  "Finding your best tags, topics and upload times",
  "Writing your 4-week plan",
];

function Building({
  analysis,
  answers,
  onDone,
  onBack,
}: {
  analysis: Promise<Report>;
  answers: Answers;
  onDone: (s: Saved) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => setPhase((p) => (p < 2 ? p + 1 : p)), 900);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const report = await analysis;
        setPhase(3);
        const { result } = await post<{ result: Plan }>("/api/youtube/suggest", {
          mode: "plan",
          context: report.context,
          ...answers,
        });
        setPhase(4);
        onDone({ answers, mine: report.mine, channel: report.channel, stats: report.stats, plan: result, createdAt: new Date().toISOString() });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
  }, [analysis, answers, onDone]);

  return (
    <section className="mx-auto max-w-md py-6" aria-live="polite">
      <h2 className="font-display text-2xl font-bold">Building your plan…</h2>
      <ul className="mt-6 space-y-3">
        {BUILD_STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                i < phase ? "bg-ink text-bg" : i === phase && !error ? "animate-pulse bg-accent text-accent-ink" : "bg-line text-muted"
              }`}
            >
              {i < phase ? "✓" : ""}
            </span>
            <span className={i <= phase ? "" : "text-muted"}>{s}</span>
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-6 rounded-xl bg-accent-soft p-4 text-sm text-accent">
          <p>{error}</p>
          <button type="button" onClick={onBack} className="mt-3 rounded-lg bg-ink px-3 py-1.5 text-bg">
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

function PlanView({ saved }: { saved: Saved }) {
  const { channel, stats, plan, answers } = saved;
  const goal = GOALS.find((g) => g.id === answers.goal);
  const subs = channel.subscribers;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {channel.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={channel.thumbnail} alt="" className="h-14 w-14 rounded-full" />
        )}
        <div>
          <p className="text-sm text-muted">
            Plan for {channel.title} · Goal: {goal?.label}
            {saved.inAccount ? " · Saved to your account ✓" : saved.mine ? "" : " · Saved in this browser"}
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">{plan.headline ?? "Your 4-week growth plan"}</h2>
        </div>
      </div>

      {plan.summary && <p className="text-lg leading-relaxed text-muted">{plan.summary}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Subscribers" value={fmt(subs)} />
        <Stat label="Median views / day" value={fmt(stats.medianViewsPerDay)} />
        <Stat label="Uploads / week" value={stats.uploadsPerWeek?.toString() ?? "—"} hint={`goal: ${answers.videosPerWeek}`} />
        <Stat label="Videos analyzed" value={String(stats.sampleSize)} />
      </div>

      {answers.goal === "monetize" && subs != null && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">
              {subs >= 1000 ? "Subscriber requirement reached ✓" : "Subscribers to monetization"}
            </span>
            <span className="font-mono">{subs >= 1000 ? `${subs.toLocaleString()} subs` : `${subs.toLocaleString()} / 1,000`}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(subs / 10, 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {subs >= 1000
              ? "Next requirement: 4,000 public watch hours in the last 12 months (or 10M Shorts views in 90 days). Check it in YouTube Studio → Earn."
              : `${(1000 - subs).toLocaleString()} to go. You also need 4,000 watch hours in the last 12 months (or 10M Shorts views in 90 days).`}
          </p>
        </div>
      )}

      {!!plan.quickWins?.length && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-bold">Do these today</h3>
          <ol className="mt-4 space-y-3">
            {plan.quickWins.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink">{i + 1}</span>
                <div>
                  <p className="font-semibold">{q.title}</p>
                  <p className="text-sm text-muted">{q.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!plan.weeks?.length && (
        <section>
          <h3 className="font-display text-lg font-bold">Your next 4 weeks</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {plan.weeks.map((w, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-accent">Week {w.week ?? i + 1}</p>
                <p className="mt-1 font-semibold">{w.focus}</p>
                <ul className="mt-3 space-y-2">
                  {w.videos?.map((v, j) => (
                    <li key={j} className="rounded-lg border border-line bg-bg px-3 py-2">
                      <p className="text-sm font-medium">
                        <span className="mr-1.5 rounded bg-line px-1.5 py-0.5 text-[10px] uppercase text-muted">
                          {v.format === "short" ? "Short" : "Video"}
                        </span>
                        {v.title}
                      </p>
                      {v.why && <p className="mt-1 text-xs text-muted">{v.why}</p>}
                    </li>
                  ))}
                </ul>
                {!!w.tasks?.length && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
                    {w.tasks.map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!!plan.habits?.length && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="font-display text-lg font-bold">Habits that will compound</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5">{plan.habits.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3 rounded-2xl bg-ink p-5 text-bg">
        <div className="flex-1">
          <p className="font-semibold">Next: fix your weakest videos</p>
          <p className="text-sm opacity-70">Open the full report to get new titles, descriptions and tags for each video.</p>
        </div>
        <Link
          href={saved.mine ? "/youtube-channel-analyzer?auto=mine" : `/youtube-channel-analyzer?channel=${encodeURIComponent(channel.id)}`}
          className="self-center rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
          Open full report →
        </Link>
      </div>
    </div>
  );
}
