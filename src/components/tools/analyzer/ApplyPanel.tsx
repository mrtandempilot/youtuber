"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

type Meta = { title: string; description: string; tags: string[] };

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

async function apply(body: Record<string, unknown>) {
  const res = await fetch("/api/youtube/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as { ok: boolean; status: number; data: { error?: string; code?: string; applied?: Meta; previous?: Meta } };
}

// Opens Google's consent screen in a popup to add "edit videos" permission.
// Resolves true when the popup reports success.
function requestWritePermission(): Promise<boolean> {
  return new Promise((resolve) => {
    const url = "/api/auth/google?write=1&next=/auth/done";
    const popup = window.open(url, "ck-google", "width=520,height=680");
    if (!popup) {
      // Popup blocked: fall back to a full-page redirect back to the analyzer.
      // (API route, not a Next.js page, so a plain navigation is correct here.)
      window.location.assign(new URL("/api/auth/google?write=1&next=/youtube-channel-analyzer", window.location.origin).href);
      return;
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "ck-auth") return;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      resolve(Boolean(e.data.ok));
    };
    window.addEventListener("message", onMessage);
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener("message", onMessage);
        resolve(false);
      }
    }, 800);
  });
}

// "Apply to YouTube": writes the AI suggestions straight to the creator's video, with Undo.
export function ApplyPanel({
  videoId,
  result,
  mine,
  onApplied,
}: {
  videoId: string;
  result: Record<string, unknown>;
  mine: boolean;
  onApplied?: (m: Meta) => void;
}) {
  const titles = asStrings(result.titles);
  const tags = asStrings(result.tags);
  const hashtags = asStrings(result.hashtags);
  const description = typeof result.description === "string" ? result.description : "";

  const [titleChoice, setTitleChoice] = useState<number>(titles.length ? 0 : -1); // -1 = keep current
  const [useDescription, setUseDescription] = useState(Boolean(description));
  const [useTags, setUseTags] = useState(tags.length > 0);
  const [useHashtags, setUseHashtags] = useState(hashtags.length > 0);
  const [stage, setStage] = useState<"idle" | "confirm" | "working" | "done" | "undone">("idle");
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<Meta | null>(null);

  if (!mine) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm">
        <p className="font-semibold">Want this applied automatically?</p>
        <p className="mt-1 text-muted">Connect your own channel and we&apos;ll update the title, description and tags on YouTube for you.</p>
        <a href="/api/auth/google?next=/youtube-channel-analyzer" className="mt-3 inline-block rounded-lg bg-ink px-3 py-1.5 font-medium text-bg">
          Connect with Google
        </a>
      </div>
    );
  }

  const nothingSelected = titleChoice < 0 && !useDescription && !useTags && !useHashtags;

  function payload() {
    return {
      videoId,
      ...(titleChoice >= 0 ? { title: titles[titleChoice] } : {}),
      ...(useDescription ? { description } : {}),
      ...(useTags ? { tags } : {}),
      ...(useHashtags ? { hashtags } : {}),
    };
  }

  async function run() {
    setStage("working");
    setError(null);
    let r = await apply(payload());
    if (!r.ok && r.data.code === "needs_write") {
      const granted = await requestWritePermission();
      if (!granted) {
        setStage("idle");
        setError("Permission wasn't granted, so nothing was changed.");
        return;
      }
      r = await apply(payload());
    }
    if (!r.ok) {
      setStage("idle");
      setError(r.data.error ?? "Couldn't update the video.");
      return;
    }
    setPrevious(r.data.previous ?? null);
    if (r.data.applied) onApplied?.(r.data.applied);
    setStage("done");
    track("Applied To YouTube", { title: titleChoice >= 0 ? 1 : 0, description: useDescription ? 1 : 0, tags: useTags ? 1 : 0 });
  }

  async function undo() {
    if (!previous) return;
    setStage("working");
    const r = await apply({ videoId, ...previous, hashtags: [] });
    if (!r.ok) {
      setStage("done");
      setError(r.data.error ?? "Undo failed.");
      return;
    }
    if (r.data.applied) onApplied?.(r.data.applied);
    setStage("undone");
    track("Apply Undone");
  }

  if (stage === "done" || stage === "undone") {
    return (
      <div className="rounded-xl border border-line bg-bg p-4 text-sm">
        <p className="font-semibold">{stage === "done" ? "✓ Updated on YouTube" : "↩ Restored the previous version"}</p>
        <p className="mt-1 text-muted">YouTube can take a few minutes to show the change everywhere.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`https://studio.youtube.com/video/${videoId}/edit`}
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
        {error && <p className="mt-2 text-accent">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-accent bg-surface p-4 text-sm">
      <p className="font-display text-base font-bold">Apply to YouTube</p>
      <p className="mt-0.5 text-muted">Pick what to change. We update your video directly — no copy-paste.</p>

      {titles.length > 0 && (
        <fieldset className="mt-3 space-y-1.5">
          <legend className="mb-1 font-semibold">Title</legend>
          {titles.map((t, i) => (
            <label key={t} className="flex cursor-pointer items-start gap-2">
              <input type="radio" name={`title-${videoId}`} checked={titleChoice === i} onChange={() => setTitleChoice(i)} className="mt-1" />
              <span>{t}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-2 text-muted">
            <input type="radio" name={`title-${videoId}`} checked={titleChoice === -1} onChange={() => setTitleChoice(-1)} className="mt-1" />
            <span>Keep current title</span>
          </label>
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {description && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useDescription} onChange={(e) => setUseDescription(e.target.checked)} /> Description
          </label>
        )}
        {tags.length > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useTags} onChange={(e) => setUseTags(e.target.checked)} /> Tags ({tags.length})
          </label>
        )}
        {hashtags.length > 0 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useHashtags} onChange={(e) => setUseHashtags(e.target.checked)} /> Hashtags
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {stage === "confirm" ? (
          <>
            <button type="button" onClick={run} className="rounded-xl bg-accent px-4 py-2 font-semibold text-accent-ink">
              Yes, update my video
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
            {stage === "working" ? "Updating…" : "Apply to YouTube"}
          </button>
        )}
        <span className="text-xs text-muted">You can undo right after.</span>
      </div>
      {error && <p className="mt-2 text-accent">{error}</p>}
    </div>
  );
}
