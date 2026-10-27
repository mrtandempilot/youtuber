import { analyzeChannel, channelContext } from "@/lib/channel-analysis";
import { getFreshSession } from "@/lib/google-oauth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  getChannel,
  getChannelAnalytics,
  getRecentVideos,
  parseChannelInput,
  publicAuth,
  YtError,
  type ChannelAnalytics,
  type YtAuth,
} from "@/lib/youtube-api";

const DAILY_LIMIT = Number(process.env.ANALYZE_DAILY_LIMIT ?? 20);

// POST { channel: "@handle | URL | UC…" }  → public analysis (API key)
// POST { mine: true }                      → connected creator's own channel + private analytics
export async function POST(request: Request) {
  let body: { channel?: unknown; mine?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const limit = rateLimit(`analyze:${clientIp(request)}`, DAILY_LIMIT);
  if (!limit.ok) {
    return Response.json({ error: "You've reached today's free analysis limit. Try again tomorrow." }, { status: 429 });
  }

  try {
    let auth: YtAuth;
    let mine = false;
    if (body.mine === true) {
      const session = await getFreshSession();
      if (!session) return Response.json({ error: "Please connect your YouTube channel again.", code: "unauthorized" }, { status: 401 });
      auth = { accessToken: session.accessToken };
      mine = true;
    } else {
      const ref = typeof body.channel === "string" ? parseChannelInput(body.channel) : null;
      if (!ref) return Response.json({ error: "Enter a channel link, @handle or channel ID." }, { status: 400 });
      auth = publicAuth();
      const channel = await getChannel(ref, auth);
      return Response.json(await build(channel, auth, null, false));
    }

    const channel = await getChannel("mine", auth);
    let analytics: ChannelAnalytics | null = null;
    try {
      analytics = await getChannelAnalytics((auth as { accessToken: string }).accessToken);
    } catch (err) {
      console.warn("analytics unavailable", err); // analytics scope may be missing; public data still works
    }
    return Response.json(await build(channel, auth, analytics, mine));
  } catch (err) {
    if (err instanceof YtError) {
      const msg = err.code === "not_configured" ? "Channel analysis isn't configured yet (missing YouTube API key)." : err.message;
      return Response.json({ error: msg, code: err.code }, { status: err.status });
    }
    console.error("channel analysis failed", err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 502 });
  }
}

async function build(
  channel: Awaited<ReturnType<typeof getChannel>>,
  auth: YtAuth,
  analytics: ChannelAnalytics | null,
  mine: boolean,
) {
  const raw = await getRecentVideos(channel.uploadsPlaylistId, auth, 50);
  const { videos, stats } = analyzeChannel(raw, analytics);
  return {
    mine,
    channel,
    stats,
    analytics: analytics
      ? { periodDays: analytics.periodDays, totals: analytics.totals, trafficSources: analytics.trafficSources, topSearchTerms: analytics.topSearchTerms }
      : null,
    videos: videos.map((v) => ({ ...v, description: v.description.slice(0, 1500) })),
    context: channelContext(channel, stats, analytics),
  };
}
