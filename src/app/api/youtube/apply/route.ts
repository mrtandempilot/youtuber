import { canWrite, getFreshSession } from "@/lib/google-oauth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getVideoSnippet, sanitizeMetadata, updateVideoSnippet, YtError } from "@/lib/youtube-api";

const DAILY_LIMIT = Number(process.env.APPLY_DAILY_LIMIT ?? 50);

const strArray = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 60) : null);

// POST { videoId, title?, description?, tags?, hashtags? }
// Writes the chosen fields to the creator's own video and returns the previous values (for Undo).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const videoId = typeof body.videoId === "string" && /^[\w-]{11}$/.test(body.videoId) ? body.videoId : null;
  if (!videoId) return Response.json({ error: "Invalid video." }, { status: 400 });

  const session = await getFreshSession();
  if (!session) return Response.json({ error: "Please connect your YouTube channel first.", code: "unauthorized" }, { status: 401 });
  if (!canWrite(session.scopes)) {
    return Response.json({ error: "Permission to edit videos is needed.", code: "needs_write" }, { status: 403 });
  }

  const limit = rateLimit(`apply:${clientIp(request)}`, DAILY_LIMIT);
  if (!limit.ok) return Response.json({ error: "Daily update limit reached. Try again tomorrow." }, { status: 429 });

  try {
    const current = await getVideoSnippet(videoId, session.accessToken);
    if (current.channelId !== session.channelId) {
      return Response.json({ error: "You can only edit videos on your connected channel." }, { status: 403 });
    }

    const previous = { title: current.title, description: current.description ?? "", tags: current.tags ?? [] };
    const next = sanitizeMetadata({
      title: typeof body.title === "string" && body.title.trim() ? body.title : previous.title,
      description: typeof body.description === "string" && body.description.trim() ? body.description : previous.description,
      tags: strArray(body.tags) ?? previous.tags,
      hashtags: strArray(body.hashtags) ?? [],
    });
    if (!next.title) return Response.json({ error: "Title can't be empty." }, { status: 400 });

    await updateVideoSnippet(videoId, current, next, session.accessToken);
    return Response.json({ ok: true, applied: next, previous });
  } catch (err) {
    if (err instanceof YtError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("apply failed", err);
    return Response.json({ error: "Couldn't update the video. Please try again." }, { status: 502 });
  }
}
