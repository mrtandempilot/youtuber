"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
] as const;

type Groups = { broad: string[]; niche: string[]; community: string[] };

const GROUP_LABELS: Record<keyof Groups, { title: string; hint: string }> = {
  broad: { title: "Broad", hint: "High reach" },
  niche: { title: "Niche", hint: "Targeted viewers" },
  community: { title: "Community", hint: "Engagement" },
};

export function HashtagGenerator() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["id"]>("tiktok");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Groups | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 3) {
      setError("Describe your video in a few words first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setGroups({ broad: data.broad, niche: data.niche, community: data.community });
      setRemoved(new Set());
      track("Hashtags Generated", { platform });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(tag: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const selected = groups
    ? [...groups.broad, ...groups.niche, ...groups.community].filter((t) => !removed.has(t))
    : [];

  async function copyAll() {
    await navigator.clipboard.writeText(selected.join(" "));
    setCopied(true);
    track("Hashtags Copied", { platform, count: selected.length });
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="topic" className="mb-2 block text-sm font-medium">What is your video about?</label>
          <textarea
            id="topic"
            rows={3}
            maxLength={300}
            placeholder="e.g. 5-minute healthy breakfast ideas for students"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Platform</legend>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition ${
                  platform === p.id ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name="platform"
                  value={p.id}
                  checked={platform === p.id}
                  onChange={() => setPlatform(p.id)}
                  className="sr-only"
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Generating…" : "Generate hashtags"}
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}

      {groups && (
        <div className="mt-6 space-y-5" aria-live="polite">
          <p className="text-sm text-muted">Tap a tag to remove it before copying.</p>
          {(Object.keys(GROUP_LABELS) as (keyof Groups)[]).map((key) =>
            groups[key].length ? (
              <div key={key}>
                <h3 className="mb-2 text-sm font-semibold">
                  {GROUP_LABELS[key].title} <span className="font-normal text-muted">· {GROUP_LABELS[key].hint}</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {groups[key].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggle(tag)}
                      aria-pressed={!removed.has(tag)}
                      className={`rounded-lg px-2.5 py-1 font-mono text-sm transition ${
                        removed.has(tag) ? "bg-line text-muted line-through" : "bg-accent-soft text-accent"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={copyAll}
              disabled={!selected.length}
              className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-50"
            >
              {copied ? "Copied!" : `Copy ${selected.length} hashtags`}
            </button>
            <span className="text-xs text-muted">Generated by AI — check they fit your video.</span>
          </div>
        </div>
      )}
    </div>
  );
}
