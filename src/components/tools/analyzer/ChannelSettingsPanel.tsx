"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import type { AnalyzedVideo } from "@/lib/channel-analysis";
import type { Channel, ChannelSettings } from "@/lib/youtube-api";
import { requestWritePermission } from "./ApplyPanel";
import { Card, Chips, CopyButton } from "./parts";

type Suggestion = {
  diagnosis?: string[];
  description?: string;
  keywords?: string[];
  trailerVideoId?: string;
  trailerReason?: string;
};

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: Record<string, unknown> & { error?: string; code?: string } };
}

// "Channel" tab: AI rewrites the channel description, keywords and trailer, and (for the
// connected owner) applies them straight to YouTube with one-click undo.
export function ChannelSettingsPanel({
  channel,
  videos,
  context,
  mine,
}: {
  channel: Channel;
  videos: AnalyzedVideo[];
  context: string;
  mine: boolean;
}) {
  const [current, setCurrent] = useState<ChannelSettings>({
    description: channel.description,
    keywords: channel.keywords,
    unsubscribedTrailer: null,
    country: channel.country,
    defaultLanguage: null,
  });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [description, setDescription] = useState("");
  const [useDescription, setUseDescription] = useState(true);
  const [useKeywords, setUseKeywords] = useState(true);
  const [useTrailer, setUseTrailer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<"idle" | "confirm" | "working" | "done" | "undone">("idle");
  const [previous, setPrevious] = useState<ChannelSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The owner's real settings (incl. trailer) come from the API; public data is the fallback.
  useEffect(() => {
    if (!mine) return;
    fetch("/api/youtube/channel-settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.settings && setCurrent(d.settings as ChannelSettings))
      .catch(() => undefined);
  }, [mine]);

  const trailerCandidates = videos
    .filter((v) => !v.isShort && v.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);
  const titleOf = (id: string | null | undefined) => videos.find((v) => v.id === id)?.title ?? id ?? "None";

  async function improve() {
    setLoading(true);
    setError(null);
    const r = await postJson("/api/youtube/suggest", {
      mode: "channel",
      context,
      current,
      trailerCandidates: trailerCandidates.map((v) => ({ id: v.id, title: v.title, score: v.score })),
    });
    setLoading(false);
    if (!r.ok) return setError(r.data.error ?? "Something went wrong.");
    const s = r.data.result as Suggestion;
    setSuggestion(s);
    setDescription(s.description ?? "");
    setUseTrailer(Boolean(s.trailerVideoId) && s.trailerVideoId !== current.unsubscribedTrailer);
    setStage("idle");
    track("Channel Settings Suggested");
  }

  const keywords = suggestion?.keywords ?? [];
  const trailer = suggestion?.trailerVideoId && trailerCandidates.some((v) => v.id === suggestion.trailerVideoId) ? suggestion.trailerVideoId : null;

  function payload() {
    return {
      ...(useDescription && description.trim() ? { description } : {}),
      ...(useKeywords && keywords.length ? { keywords } : {}),
      ...(useTrailer && trailer ? { unsubscribedTrailer: trailer } : {}),
    };
  }

  async function apply() {
    setStage("working");
    setError(null);
    let r = await postJson("/api/youtube/channel-settings", payload());
    if (!r.ok && r.data.code === "needs_write") {
      if (!(await requestWritePermission())) {
        setStage("idle");
        return setError("Permission wasn't granted, so nothing was changed.");
      }
      r = await postJson("/api/youtube/channel-settings", payload());
    }
    if (!r.ok) {
      setStage("idle");
      return setError(r.data.error ?? "Couldn't update your channel.");
    }
    setPrevious(r.data.previous as ChannelSettings);
    setCurrent(r.data.applied as ChannelSettings);
    setStage("done");
    track("Channel Settings Applied");
  }

  async function undo() {
    if (!previous) return;
    setStage("working");
    const r = await postJson("/api/youtube/channel-settings", previous);
    if (!r.ok) {
      setStage("done");
      return setError(r.data.error ?? "Undo failed.");
    }
    setCurrent(r.data.applied as ChannelSettings);
    setStage("undone");
    track("Channel Settings Undone");
  }

  const nothingSelected = !(useDescription && description.trim()) && !(useKeywords && keywords.length) && !(useTrailer && trailer);

  return (
    <div className="space-y-5">
      <Card title="Current channel settings" subtitle="What YouTube and Google read about your channel.">
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="mb-1 font-semibold">
              Description <span className="font-normal text-muted">({current.description.length}/1000)</span>
            </h4>
            <p className="whitespace-pre-wrap text-muted">{current.description || "Empty — this is a big missed opportunity."}</p>
          </div>
          <div>
            <h4 className="mb-1 font-semibold">Keywords</h4>
            {current.keywords.length ? <Chips tone="muted" items={current.keywords} /> : <p className="text-muted">None set.</p>}
          </div>
          {mine && (
            <div>
              <h4 className="mb-1 font-semibold">Trailer for new visitors</h4>
              <p className="text-muted">{current.unsubscribedTrailer ? titleOf(current.unsubscribedTrailer) : "None set."}</p>
            </div>
          )}
        </div>
        {!suggestion && (
          <button
            type="button"
            disabled={loading}
            onClick={improve}
            className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Thinking…" : "Improve with AI"}
          </button>
        )}
        {error && !suggestion && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>

      {suggestion && (
        <Card
          title="AI suggestion"
          subtitle="Edit anything before applying."
          action={
            <button type="button" onClick={improve} disabled={loading} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink">
              {loading ? "Thinking…" : "Regenerate"}
            </button>
          }
        >
          <div className="space-y-5 text-sm">
            {!!suggestion.diagnosis?.length && (
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {suggestion.diagnosis.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 font-semibold">
                  {mine && <input type="checkbox" checked={useDescription} onChange={(e) => setUseDescription(e.target.checked)} />}
                  New description <span className="font-normal text-muted">({description.length}/1000)</span>
                </label>
                <CopyButton text={description} />
              </div>
              <textarea
                value={description}
                maxLength={1000}
                rows={7}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-line bg-bg p-3 outline-none focus:border-accent"
              />
            </div>

            {keywords.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-semibold">
                    {mine && <input type="checkbox" checked={useKeywords} onChange={(e) => setUseKeywords(e.target.checked)} />}
                    Channel keywords
                  </label>
                  <CopyButton text={keywords.join(", ")} />
                </div>
                <Chips items={keywords} />
              </div>
            )}

            {trailer && mine && (
              <div>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={useTrailer} onChange={(e) => setUseTrailer(e.target.checked)} />
                  Trailer for new visitors: <span className="font-normal">{titleOf(trailer)}</span>
                </label>
                {suggestion.trailerReason && <p className="mt-1 pl-6 text-muted">{suggestion.trailerReason}</p>}
              </div>
            )}

            {!mine ? (
              <div className="rounded-xl border border-dashed border-line p-4">
                <p className="font-semibold">Want this applied automatically?</p>
                <p className="mt-1 text-muted">Connect your own channel and we&apos;ll update these settings on YouTube for you.</p>
                <a href="/api/auth/google?next=/youtube-channel-analyzer" className="mt-3 inline-block rounded-lg bg-ink px-3 py-1.5 font-medium text-bg">
                  Connect with Google
                </a>
              </div>
            ) : stage === "done" || stage === "undone" ? (
              <div className="rounded-xl border border-line bg-bg p-4">
                <p className="font-semibold">{stage === "done" ? "✓ Channel updated on YouTube" : "↩ Restored your previous settings"}</p>
                <p className="mt-1 text-muted">Changes can take a few minutes to appear on your channel page.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="https://studio.youtube.com/channel/editing/details"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-line px-3 py-1.5 hover:border-ink"
                  >
                    Open in YouTube Studio
                  </a>
                  {stage === "done" && previous && (
                    <button type="button" onClick={undo} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink">
                      Undo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {stage === "confirm" ? (
                  <>
                    <button type="button" onClick={apply} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink">
                      Yes, update my channel
                    </button>
                    <button type="button" onClick={() => setStage("idle")} className="rounded-xl border border-line px-4 py-2">
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={nothingSelected || stage === "working"}
                    onClick={() => setStage("confirm")}
                    className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
                  >
                    {stage === "working" ? "Updating…" : "Apply to my channel"}
                  </button>
                )}
                <span className="text-xs text-muted">You can undo right after.</span>
              </div>
            )}
            {error && <p className="text-accent">{error}</p>}
          </div>
        </Card>
      )}

      <p className="text-xs text-muted">
        Channel name, @handle, profile picture, banner and links can only be changed in YouTube Studio.
      </p>
    </div>
  );
}
