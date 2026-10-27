import type { ChannelAnalytics, Video } from "./youtube-api";

// Pure, deterministic channel analysis (no AI). The AI layer builds on top of these numbers.

const DAY = 86400_000;
const SHORT_MAX_SEC = 180; // YouTube Shorts can be up to 3 minutes
const MIN_AGE_DAYS = 3; // too-new videos haven't settled yet

export type VideoIssue =
  | "no_tags"
  | "few_tags"
  | "short_description"
  | "no_hashtags"
  | "long_title"
  | "short_title"
  | "no_links_or_timestamps";

export type AnalyzedVideo = Video & {
  ageDays: number;
  viewsPerDay: number;
  score: number | null; // viewsPerDay ÷ channel median (1 = typical, 2 = twice as good)
  engagementRate: number | null; // (likes + comments) / views
  isShort: boolean;
  hashtags: string[];
  issues: VideoIssue[];
  analytics?: ChannelAnalytics["byVideo"][string];
};

export type Bucket = { label: string; videos: number; medianScore: number };

export type ChannelStats = {
  sampleSize: number;
  medianViews: number;
  medianViewsPerDay: number;
  avgEngagementRate: number | null;
  uploadsPerWeek: number | null;
  daysSinceLastUpload: number | null;
  top: AnalyzedVideo[];
  underperformers: AnalyzedVideo[];
  topTags: { tag: string; videos: number; medianScore: number }[];
  weakTags: { tag: string; videos: number; medianScore: number }[];
  topHashtags: { tag: string; videos: number; medianScore: number }[];
  byWeekday: Bucket[];
  byHour: Bucket[]; // UTC
  titleLength: Bucket[];
  format: { shorts: Bucket; long: Bucket };
  issueCounts: Record<VideoIssue, number>;
};

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function extractHashtags(text: string): string[] {
  // Must contain a letter: "#12" in "Weekly vlog #12" is an episode number, not a hashtag.
  return Array.from(
    new Set(
      Array.from(text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]{2,50})/gu), (m) => m[1])
        .filter((t) => /\p{L}/u.test(t))
        .map((t) => `#${t.toLowerCase()}`),
    ),
  );
}

function findIssues(v: Video, hashtags: string[]): VideoIssue[] {
  const issues: VideoIssue[] = [];
  if (!v.tags.length) issues.push("no_tags");
  else if (v.tags.length < 5) issues.push("few_tags");
  if (v.description.trim().length < 200) issues.push("short_description");
  if (!hashtags.length) issues.push("no_hashtags");
  if (v.title.length > 70) issues.push("long_title");
  if (v.title.length < 20) issues.push("short_title");
  if (v.durationSec > 600 && !/\d{1,2}:\d{2}/.test(v.description) && !/https?:\/\//.test(v.description))
    issues.push("no_links_or_timestamps");
  return issues;
}

function bucketize<T extends string>(
  videos: AnalyzedVideo[],
  keyOf: (v: AnalyzedVideo) => T,
  order: T[],
): Bucket[] {
  return order
    .map((label) => {
      const scores = videos.filter((v) => keyOf(v) === label && v.score != null).map((v) => v.score as number);
      return { label, videos: scores.length, medianScore: round(median(scores)) };
    })
    .filter((b) => b.videos > 0);
}

function tagStats(videos: AnalyzedVideo[], tagsOf: (v: AnalyzedVideo) => string[], minVideos: number) {
  const map = new Map<string, { display: string; scores: number[] }>();
  for (const v of videos) {
    if (v.score == null) continue;
    for (const t of new Set(tagsOf(v).map((x) => x.trim()).filter(Boolean))) {
      const k = t.toLowerCase();
      const e = map.get(k) ?? { display: t, scores: [] };
      e.scores.push(v.score);
      map.set(k, e);
    }
  }
  return Array.from(map.values())
    .filter((e) => e.scores.length >= minVideos)
    .map((e) => ({ tag: e.display, videos: e.scores.length, medianScore: round(median(e.scores)) }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"];
const TITLE_LENGTHS = ["<30", "30–50", "50–70", "70+"];

export function analyzeChannel(videos: Video[], analytics?: ChannelAnalytics | null, now = Date.now()) {
  const analyzed: AnalyzedVideo[] = videos.map((v) => {
    const ageDays = Math.max((now - new Date(v.publishedAt).getTime()) / DAY, 0.5);
    const hashtags = extractHashtags(`${v.title}\n${v.description}`);
    return {
      ...v,
      ageDays: round(ageDays, 1),
      viewsPerDay: round(v.views / ageDays, 1),
      score: null,
      engagementRate: v.views > 0 && v.likes != null ? round(((v.likes ?? 0) + (v.comments ?? 0)) / v.views, 4) : null,
      isShort: v.durationSec > 0 && v.durationSec <= SHORT_MAX_SEC,
      hashtags,
      issues: findIssues(v, hashtags),
      analytics: analytics?.byVideo[v.id],
    };
  });

  // Score each video against the median of its own format (Shorts and long videos behave very differently).
  for (const isShort of [true, false]) {
    const group = analyzed.filter((v) => v.isShort === isShort && v.ageDays >= MIN_AGE_DAYS);
    const med = median(group.map((v) => v.viewsPerDay)) || 1;
    for (const v of group) v.score = round(v.viewsPerDay / med);
  }

  const settled = analyzed.filter((v) => v.score != null);
  const byScore = [...settled].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const dates = analyzed.map((v) => new Date(v.publishedAt).getTime()).sort((a, b) => b - a);
  const spanDays = dates.length > 1 ? (dates[0] - dates[dates.length - 1]) / DAY : 0;

  const engagement = analyzed.map((v) => v.engagementRate).filter((x): x is number => x != null);
  const allTags = tagStats(settled, (v) => v.tags, 2).sort((a, b) => b.medianScore - a.medianScore);

  const issueCounts = Object.fromEntries(
    (["no_tags", "few_tags", "short_description", "no_hashtags", "long_title", "short_title", "no_links_or_timestamps"] as VideoIssue[]).map(
      (k) => [k, analyzed.filter((v) => v.issues.includes(k)).length],
    ),
  ) as Record<VideoIssue, number>;

  const fmt = (isShort: boolean): Bucket => {
    const s = settled.filter((v) => v.isShort === isShort);
    return {
      label: isShort ? "Shorts" : "Long videos",
      videos: s.length,
      medianScore: round(median(s.map((v) => v.viewsPerDay))), // raw views/day so formats are comparable
    };
  };

  const stats: ChannelStats = {
    sampleSize: analyzed.length,
    medianViews: median(analyzed.map((v) => v.views)),
    medianViewsPerDay: round(median(settled.map((v) => v.viewsPerDay)), 1),
    avgEngagementRate: engagement.length ? round(engagement.reduce((a, b) => a + b, 0) / engagement.length, 4) : null,
    uploadsPerWeek: spanDays > 0 ? round(((analyzed.length - 1) / spanDays) * 7, 1) : null,
    daysSinceLastUpload: dates.length ? round((now - dates[0]) / DAY, 1) : null,
    top: byScore.slice(0, 5),
    underperformers: byScore.slice(-5).reverse().filter((v) => (v.score ?? 1) < 0.8),
    topTags: allTags.filter((t) => t.medianScore >= 1).slice(0, 15),
    weakTags: [...allTags].reverse().filter((t) => t.medianScore < 0.8).slice(0, 10),
    topHashtags: tagStats(settled, (v) => v.hashtags, 2)
      .sort((a, b) => b.medianScore - a.medianScore)
      .slice(0, 10),
    byWeekday: bucketize(settled, (v) => WEEKDAYS[new Date(v.publishedAt).getUTCDay()], WEEKDAYS),
    byHour: bucketize(settled, (v) => HOURS[Math.floor(new Date(v.publishedAt).getUTCHours() / 4)], HOURS),
    titleLength: bucketize(
      settled,
      (v) => (v.title.length < 30 ? "<30" : v.title.length < 50 ? "30–50" : v.title.length < 70 ? "50–70" : "70+"),
      TITLE_LENGTHS,
    ),
    format: { shorts: fmt(true), long: fmt(false) },
    issueCounts,
  };

  return { videos: analyzed, stats };
}

// Compact text summary of the channel used as context for every AI prompt.
export function channelContext(
  channel: { title: string; description: string; subscribers: number | null; keywords: string[] },
  stats: ChannelStats,
  analytics?: ChannelAnalytics | null,
) {
  const lines = [
    `Channel: ${channel.title} (${channel.subscribers ?? "hidden"} subscribers)`,
    `About: ${channel.description.slice(0, 400)}`,
    channel.keywords.length ? `Channel keywords: ${channel.keywords.slice(0, 20).join(", ")}` : "",
    `Median views/day: ${stats.medianViewsPerDay}; uploads/week: ${stats.uploadsPerWeek ?? "n/a"}`,
    `Best performing videos: ${stats.top.map((v) => `"${v.title}" (${v.score}x)`).join("; ")}`,
    stats.underperformers.length ? `Weak videos: ${stats.underperformers.map((v) => `"${v.title}" (${v.score}x)`).join("; ")}` : "",
    stats.topTags.length ? `Tags linked to above-average videos: ${stats.topTags.map((t) => t.tag).join(", ")}` : "",
    stats.topHashtags.length ? `Hashtags linked to good videos: ${stats.topHashtags.map((t) => t.tag).join(" ")}` : "",
    `Format: Shorts ${stats.format.shorts.videos} videos (${stats.format.shorts.medianScore} views/day), long ${stats.format.long.videos} videos (${stats.format.long.medianScore} views/day)`,
    analytics?.topSearchTerms.length
      ? `Real YouTube search terms viewers used to find the channel: ${analytics.topSearchTerms.slice(0, 15).map((t) => t.term).join(", ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}
