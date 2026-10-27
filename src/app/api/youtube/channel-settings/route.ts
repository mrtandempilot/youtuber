import { connection } from "next/server";
import { canWrite, getFreshSession } from "@/lib/google-oauth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  getChannelSettings,
  sanitizeChannelSettings,
  updateChannelSettings,
  YtError,
  type ChannelSettings,
} from "@/lib/youtube-api";

const DAILY_LIMIT = Number(process.env.APPLY_DAILY_LIMIT ?? 50);

function errorResponse(err: unknown) {
  if (err instanceof YtError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
  console.error("channel settings failed", err);
  return Response.json({ error: "Couldn't update your channel. Please try again." }, { status: 502 });
}

// GET → the connected creator's current channel settings
export async function GET() {
  await connection(); // per-request: reads the session cookie
  const session = await getFreshSession();
  if (!session) return Response.json({ error: "Please connect your YouTube channel first.", code: "unauthorized" }, { status: 401 });
  try {
    const { settings } = await getChannelSettings(session.accessToken);
    return Response.json({ settings, canWrite: canWrite(session.scopes) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST { description?, keywords?, unsubscribedTrailer?, country?, defaultLanguage? }
// Changes only the fields sent, keeps the rest, returns the previous settings (for Undo).
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const session = await getFreshSession();
  if (!session) return Response.json({ error: "Please connect your YouTube channel first.", code: "unauthorized" }, { status: 401 });
  if (!canWrite(session.scopes)) {
    return Response.json({ error: "Permission to edit your channel is needed.", code: "needs_write" }, { status: 403 });
  }
  const limit = rateLimit(`apply:${clientIp(request)}`, DAILY_LIMIT);
  if (!limit.ok) return Response.json({ error: "Daily update limit reached. Try again tomorrow." }, { status: 429 });

  try {
    const { channelId, raw, settings: previous } = await getChannelSettings(session.accessToken);
    if (session.channelId && channelId !== session.channelId) {
      return Response.json({ error: "Connected channel changed. Please reconnect." }, { status: 409 });
    }
    const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);
    const merged: ChannelSettings = {
      description: str("description") ?? previous.description,
      keywords: Array.isArray(body.keywords)
        ? body.keywords.filter((x): x is string => typeof x === "string").slice(0, 60)
        : previous.keywords,
      unsubscribedTrailer: "unsubscribedTrailer" in body ? (str("unsubscribedTrailer") ?? null) : previous.unsubscribedTrailer,
      country: str("country")?.toUpperCase() ?? previous.country,
      defaultLanguage: str("defaultLanguage") ?? previous.defaultLanguage,
    };
    const next = sanitizeChannelSettings(merged);
    await updateChannelSettings(channelId, raw, next, session.accessToken);
    return Response.json({ ok: true, applied: next, previous });
  } catch (err) {
    return errorResponse(err);
  }
}
