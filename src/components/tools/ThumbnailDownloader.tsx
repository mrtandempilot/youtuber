"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { extractVideoId, THUMBNAIL_SIZES, thumbnailUrl, type ThumbnailKey } from "@/lib/youtube";

export function ThumbnailDownloader() {
  const [input, setInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<ThumbnailKey>>(new Set());
  const [copied, setCopied] = useState<ThumbnailKey | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = extractVideoId(input);
    setMissing(new Set());
    if (!id) {
      setVideoId(null);
      setError("That doesn't look like a YouTube link. Try something like youtube.com/watch?v=… or youtu.be/…");
      return;
    }
    setError(null);
    setVideoId(id);
    track("Thumbnail Lookup");
  }

  // YouTube serves a 120×90 grey placeholder when a size doesn't exist.
  function onImgLoad(key: ThumbnailKey, img: HTMLImageElement) {
    if (key !== "default" && img.naturalWidth <= 120) {
      setMissing((prev) => new Set(prev).add(key));
    }
  }

  async function copy(key: ThumbnailKey) {
    if (!videoId) return;
    await navigator.clipboard.writeText(thumbnailUrl(videoId, key));
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const sizes = THUMBNAIL_SIZES.filter((s) => !missing.has(s.key));

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="yt-url" className="sr-only">YouTube video URL</label>
        <input
          id="yt-url"
          type="text"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste a YouTube or Shorts link…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink hover:opacity-90"
        >
          Get thumbnails
        </button>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}

      {videoId && (
        <ul className="mt-6 space-y-5">
          {sizes.map((s) => (
            <li key={s.key} className="rounded-xl border border-line p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl(videoId, s.key)}
                alt={`YouTube thumbnail ${s.label} (${s.size})`}
                loading="lazy"
                onLoad={(e) => onImgLoad(s.key, e.currentTarget)}
                className="w-full rounded-lg bg-line"
                style={s.key === "default" || s.key === "mqdefault" ? { maxWidth: s.key === "default" ? 120 : 320 } : undefined}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-semibold">{s.label}</span>{" "}
                  <span className="text-muted">{s.size}</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(s.key)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-ink"
                  >
                    {copied === s.key ? "Copied!" : "Copy URL"}
                  </button>
                  <a
                    href={`/api/thumbnail?id=${videoId}&q=${s.key}`}
                    onClick={() => track("Thumbnail Download", { size: s.key })}
                    className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-bg hover:opacity-90"
                  >
                    Download
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
