// Thin wrapper around the YouTube Data API v3 and YouTube Analytics API v2.
// Public data uses YOUTUBE_API_KEY; a connected creator's own channel uses their OAuth access token.
// Quota cost per full analysis: ~3–4 units (channels.list + playlistItems.list + videos.list).

export type YtAuth = { accessToken: string } | { apiKey: string };

export class YtError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "youtube_error",
  ) {
    super(message);
  }
}

export function publicAuth(): YtAuth {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YtError("YOUTUBE_API_KEY is not set", 503, "not_configured");
  return { apiKey };
}

async function yt<T>(base: string, path: string, params: Record<string, string>, auth: YtAuth): Promise<T> {
  const url = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  if ("apiKey" in auth) url.searchParams.set("key", auth.apiKey);
  else headers.authorization = `Bearer ${auth.accessToken}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason ?? "";
    if (res.status === 401) throw new YtError("Your Google session expired. Please reconnect.", 401, "unauthorized");
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
      throw new YtError("Daily YouTube API quota reached. Please try again tomorrow.", 429, "quota");
    throw new YtError(body.error?.message ?? `YouTube API error ${res.status}`, res.status >= 500 ? 502 : res.status);
  }
  return (await res.json()) as T;
}

const DATA = "https://www.googleapis.com/youtube/v3";
const ANALYTICS = "https://youtubeanalytics.googleapis.com/v2";

// ---------- Channel lookup ----------

export type ChannelRef = { id: string } | { handle: string } | { username: string } | { query: string };

// Accepts @handle, a channel URL (/@handle, /channel/UC…, /user/…, /c/…) or a raw UC… ID.
export function parseChannelInput(input: string): ChannelRef | null {
  const v = input.trim();
  if (!v) return null;
  if (/^UC[\w-]{22}$/.test(v)) return { id: v };
  if (/^@[\w.-]{3,30}$/.test(v)) return { handle: v };

  let url: URL | null = null;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    url = null;
  }
  if (url && /(^|\.)youtube\.com$/.test(url.hostname)) {
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (first?.startsWith("@")) return { handle: decodeURIComponent(first) };
    if (first === "channel" && second && /^UC[\w-]{22}$/.test(second)) return { id: second };
    if (first === "user" && second) return { username: second };
    if (first === "c" && second) return { query: second };
    return null;
  }
  // Bare word: treat as a handle first.
  if (/^[\w.-]{3,30}$/.test(v)) return { handle: `@${v}` };
  return v.length <= 100 ? { query: v } : null;
}

type ChannelsResponse = {
  items?: {
    id: string;
    snippet: { title: string; description: string; customUrl?: string; publishedAt: string; country?: string; thumbnails?: Record<string, { url: string }> };
    statistics: { viewCount?: string; subscriberCount?: string; hiddenSubscriberCount?: boolean; videoCount?: string };
    contentDetails: { relatedPlaylists: { uploads: string } };
    brandingSettings?: { channel?: { keywords?: string } };
  }[];
};

export type Channel = {
  id: string;
  title: string;
  handle: string | null;
  description: string;
  thumbnail: string | null;
  country: string | null;
  publishedAt: string;
  subscribers: number | null;
  views: number;
  videoCount: number;
  uploadsPlaylistId: string;
  keywords: string[];
};

function parseKeywords(raw?: string): string[] {
  if (!raw) return [];
  // Keywords are space-separated; multi-word keywords are wrapped in quotes.
  return Array.from(raw.matchAll(/"([^"]+)"|(\S+)/g), (m) => (m[1] ?? m[2]).trim()).filter(Boolean);
}

const CHANNEL_PARTS = "snippet,statistics,contentDetails,brandingSettings";

export async function getChannel(ref: ChannelRef | "mine", auth: YtAuth): Promise<Channel> {
  let params: Record<string, string>;
  if (ref === "mine") params = { mine: "true" };
  else if ("id" in ref) params = { id: ref.id };
  else if ("handle" in ref) params = { forHandle: ref.handle };
  else if ("username" in ref) params = { forUsername: ref.username };
  else {
    // Free-text search costs 100 quota units, so it's the last resort.
    const search = await yt<{ items?: { snippet: { channelId: string } }[] }>(
      DATA,
      "search",
      { part: "snippet", type: "channel", maxResults: "1", q: ref.query },
      auth,
    );
    const id = search.items?.[0]?.snippet.channelId;
    if (!id) throw new YtError("Channel not found.", 404, "not_found");
    params = { id };
  }

  const data = await yt<ChannelsResponse>(DATA, "channels", { part: CHANNEL_PARTS, ...params }, auth);
  const c = data.items?.[0];
  if (!c) {
    throw new YtError(
      ref === "mine" ? "This Google account has no YouTube channel." : "Channel not found. Check the link or @handle.",
      404,
      "not_found",
    );
  }
  const thumbs = c.snippet.thumbnails ?? {};
  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? null,
    description: c.snippet.description,
    thumbnail: thumbs.medium?.url ?? thumbs.default?.url ?? null,
    country: c.snippet.country ?? null,
    publishedAt: c.snippet.publishedAt,
    subscribers: c.statistics.hiddenSubscriberCount ? null : Number(c.statistics.subscriberCount ?? 0),
    views: Number(c.statistics.viewCount ?? 0),
    videoCount: Number(c.statistics.videoCount ?? 0),
    uploadsPlaylistId: c.contentDetails.relatedPlaylists.uploads,
    keywords: parseKeywords(c.brandingSettings?.channel?.keywords),
  };
}

// ---------- Videos ----------

export type Video = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number | null;
  comments: number | null;
  thumbnail: string | null;
  categoryId: string | null;
  defaultLanguage: string | null;
};

// ISO 8601 duration (PT1H2M3S / P1DT2H) → seconds.
export function parseDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

type VideosResponse = {
  items?: {
    id: string;
    snippet: {
      title: string;
      description: string;
      tags?: string[];
      publishedAt: string;
      categoryId?: string;
      defaultLanguage?: string;
      defaultAudioLanguage?: string;
      liveBroadcastContent?: string;
      thumbnails?: Record<string, { url: string }>;
    };
    contentDetails: { duration: string };
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  }[];
};

// Most recent uploads (max 50 = one playlistItems call + one videos call).
export async function getRecentVideos(uploadsPlaylistId: string, auth: YtAuth, max = 50): Promise<Video[]> {
  const list = await yt<{ items?: { contentDetails: { videoId: string } }[] }>(
    DATA,
    "playlistItems",
    { part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: String(Math.min(max, 50)) },
    auth,
  ).catch((err) => {
    // Channels with zero uploads return 404 for the uploads playlist.
    if (err instanceof YtError && err.status === 404) return { items: [] };
    throw err;
  });

  const ids = (list.items ?? []).map((i) => i.contentDetails.videoId);
  if (!ids.length) return [];

  const data = await yt<VideosResponse>(
    DATA,
    "videos",
    { part: "snippet,contentDetails,statistics", id: ids.join(","), maxResults: "50" },
    auth,
  );

  return (data.items ?? [])
    .filter((v) => v.snippet.liveBroadcastContent !== "upcoming")
    .map((v) => {
      const thumbs = v.snippet.thumbnails ?? {};
      return {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        tags: v.snippet.tags ?? [],
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails.duration),
        views: Number(v.statistics.viewCount ?? 0),
        likes: v.statistics.likeCount != null ? Number(v.statistics.likeCount) : null,
        comments: v.statistics.commentCount != null ? Number(v.statistics.commentCount) : null,
        thumbnail: thumbs.medium?.url ?? thumbs.default?.url ?? null,
        categoryId: v.snippet.categoryId ?? null,
        defaultLanguage: v.snippet.defaultLanguage ?? v.snippet.defaultAudioLanguage ?? null,
      };
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ---------- Private analytics (connected owner only) ----------

export type VideoAnalytics = {
  views: number;
  minutesWatched: number;
  avgViewDurationSec: number;
  avgViewPercentage: number;
  subscribersGained: number;
};

export type ChannelAnalytics = {
  periodDays: number;
  totals: VideoAnalytics;
  byVideo: Record<string, VideoAnalytics>;
  trafficSources: { source: string; views: number }[];
  topSearchTerms: { term: string; views: number }[];
};

type Report = { columnHeaders?: { name: string }[]; rows?: (string | number)[][] };

function rowsToObjects(r: Report) {
  const names = (r.columnHeaders ?? []).map((h) => h.name);
  return (r.rows ?? []).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])) as Record<string, string | number>);
}

function toAnalytics(o: Record<string, string | number>): VideoAnalytics {
  return {
    views: Number(o.views ?? 0),
    minutesWatched: Number(o.estimatedMinutesWatched ?? 0),
    avgViewDurationSec: Number(o.averageViewDuration ?? 0),
    avgViewPercentage: Number(o.averageViewPercentage ?? 0),
    subscribersGained: Number(o.subscribersGained ?? 0),
  };
}

export async function getChannelAnalytics(accessToken: string, periodDays = 90): Promise<ChannelAnalytics> {
  const auth = { accessToken };
  const end = new Date();
  const start = new Date(end.getTime() - periodDays * 86400_000);
  const base = {
    ids: "channel==MINE",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
  const metrics = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained";

  const [totals, byVideo, traffic, search] = await Promise.all([
    yt<Report>(ANALYTICS, "reports", { ...base, metrics }, auth),
    yt<Report>(ANALYTICS, "reports", { ...base, metrics, dimensions: "video", sort: "-views", maxResults: "200" }, auth),
    yt<Report>(ANALYTICS, "reports", { ...base, metrics: "views", dimensions: "insightTrafficSourceType", sort: "-views" }, auth),
    yt<Report>(
      ANALYTICS,
      "reports",
      { ...base, metrics: "views", dimensions: "insightTrafficSourceDetail", filters: "insightTrafficSourceType==YT_SEARCH", sort: "-views", maxResults: "25" },
      auth,
    ).catch(() => ({}) as Report), // search terms can be unavailable for small channels
  ]);

  return {
    periodDays,
    totals: toAnalytics(rowsToObjects(totals)[0] ?? {}),
    byVideo: Object.fromEntries(rowsToObjects(byVideo).map((o) => [String(o.video), toAnalytics(o)])),
    trafficSources: rowsToObjects(traffic).map((o) => ({ source: String(o.insightTrafficSourceType), views: Number(o.views) })),
    topSearchTerms: rowsToObjects(search).map((o) => ({ term: String(o.insightTrafficSourceDetail), views: Number(o.views) })),
  };
}

// ---------- Editing a video (connected owner with write permission) ----------

type VideoSnippet = {
  title: string;
  description?: string;
  tags?: string[];
  categoryId: string;
  channelId: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
};

export type VideoMetadata = { title: string; description: string; tags: string[] };

export async function getVideoSnippet(videoId: string, accessToken: string): Promise<VideoSnippet> {
  const data = await yt<{ items?: { snippet: VideoSnippet }[] }>(DATA, "videos", { part: "snippet", id: videoId }, { accessToken });
  const s = data.items?.[0]?.snippet;
  if (!s) throw new YtError("Video not found.", 404, "not_found");
  return s;
}

// Replaces title/description/tags while keeping every other snippet field intact
// (videos.update clears snippet fields that aren't sent). Costs 50 quota units.
export async function updateVideoSnippet(videoId: string, current: VideoSnippet, next: VideoMetadata, accessToken: string) {
  const snippet: Record<string, unknown> = {
    title: next.title,
    description: next.description,
    tags: next.tags,
    categoryId: current.categoryId,
  };
  if (current.defaultLanguage) snippet.defaultLanguage = current.defaultLanguage;
  if (current.defaultAudioLanguage) snippet.defaultAudioLanguage = current.defaultAudioLanguage;

  const res = await fetch(`${DATA}/videos?part=snippet`, {
    method: "PUT",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ id: videoId, snippet }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; errors?: { reason?: string }[] } };
    const reason = body.error?.errors?.[0]?.reason ?? "";
    if (res.status === 401) throw new YtError("Your Google session expired. Please reconnect.", 401, "unauthorized");
    if (res.status === 403 && /insufficient|scope|permission/i.test(`${reason} ${body.error?.message}`))
      throw new YtError("Permission to edit videos is needed.", 403, "needs_write");
    if (reason === "quotaExceeded") throw new YtError("Daily YouTube API quota reached. Please try again tomorrow.", 429, "quota");
    throw new YtError(body.error?.message ?? `YouTube update failed (${res.status})`, res.status >= 500 ? 502 : 400);
  }
}

// YouTube limits: title ≤ 100 chars, description ≤ 5000 bytes, tags ≤ 500 chars total
// (multi-word tags count their surrounding quotes). Angle brackets are rejected.
const noAngles = (s: string) => s.replace(/[<>]/g, "");

export function sanitizeMetadata(input: { title: string; description: string; tags: string[]; hashtags?: string[] }): VideoMetadata {
  const title = noAngles(input.title).replace(/\s+/g, " ").trim().slice(0, 100);

  let description = noAngles(input.description).trim();
  const missing = (input.hashtags ?? [])
    .map((h) => `#${h.replace(/^#+/, "").replace(/\s+/g, "")}`)
    .filter((h) => h.length > 1 && !description.toLowerCase().includes(h.toLowerCase()));
  if (missing.length) description = `${description}\n\n${missing.join(" ")}`.trim();
  while (Buffer.byteLength(description, "utf8") > 5000) description = description.slice(0, -50);

  const tags: string[] = [];
  let used = 0;
  for (const raw of input.tags) {
    const tag = noAngles(raw).replace(/^#/, "").replace(/,/g, " ").replace(/\s+/g, " ").trim();
    if (!tag || tag.length > 100 || tags.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
    const cost = tag.length + (tag.includes(" ") ? 2 : 0) + (tags.length ? 1 : 0);
    if (used + cost > 500) continue;
    tags.push(tag);
    used += cost;
  }
  return { title, description, tags };
}
