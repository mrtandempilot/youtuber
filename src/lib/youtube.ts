const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function isValidVideoId(id: string) {
  return ID_RE.test(id);
}

// Extracts the 11-character video ID from any common YouTube URL format, or a bare ID.
export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (isValidVideoId(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const m = url.pathname.match(/^\/(shorts|embed|live|v|e)\/([^/?#]+)/);
      candidate = m?.[2] ?? null;
    }
  }

  return candidate && isValidVideoId(candidate) ? candidate : null;
}

export const THUMBNAIL_SIZES = [
  { key: "maxresdefault", label: "Max resolution", size: "1280×720" },
  { key: "sddefault", label: "Standard", size: "640×480" },
  { key: "hqdefault", label: "High", size: "480×360" },
  { key: "mqdefault", label: "Medium", size: "320×180" },
  { key: "default", label: "Default", size: "120×90" },
] as const;

export type ThumbnailKey = (typeof THUMBNAIL_SIZES)[number]["key"];

export function isThumbnailKey(k: string): k is ThumbnailKey {
  return THUMBNAIL_SIZES.some((s) => s.key === k);
}

export function thumbnailUrl(id: string, key: ThumbnailKey) {
  return `https://i.ytimg.com/vi/${id}/${key}.jpg`;
}
