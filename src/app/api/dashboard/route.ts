import { connection } from "next/server";
import { recentChanges } from "@/lib/db";
import { getFreshSession } from "@/lib/google-oauth";
import { getChannel, getDashboard, videoImpact, YtError } from "@/lib/youtube-api";

const PERIODS = [7, 28, 90, 365];

// GET ?days=28 → growth dashboard for the connected creator (private YouTube Analytics).
export async function GET(request: Request) {
  await connection();
  const session = await getFreshSession();
  if (!session) return Response.json({ error: "Connect your YouTube channel to see your dashboard.", code: "unauthorized" }, { status: 401 });

  const requested = Number(new URL(request.url).searchParams.get("days"));
  const days = PERIODS.includes(requested) ? requested : 28;

  try {
    const [dashboard, channel, changes] = await Promise.all([
      getDashboard(session.accessToken, days),
      getChannel("mine", { accessToken: session.accessToken }),
      session.profileId ? recentChanges(session.profileId, 8) : Promise.resolve([]),
    ]);

    // Impact of video changes: avg daily views 7 days before vs after (skips undone/very recent ones gracefully).
    const impacts = await Promise.all(
      changes.map(async (c) => {
        if (c.kind !== "video" || !c.video_id) return null;
        try {
          return await videoImpact(session.accessToken, c.video_id, c.created_at);
        } catch {
          return null;
        }
      }),
    );

    return Response.json(
      {
        ...dashboard,
        channel: { id: channel.id, title: channel.title, thumbnail: channel.thumbnail, subscribers: channel.subscribers, views: channel.views, videoCount: channel.videoCount },
        changes: changes.map((c, i) => ({
          id: c.id,
          kind: c.kind,
          videoId: c.video_id,
          title: (c.applied?.title as string | undefined) ?? null,
          previousTitle: (c.previous?.title as string | undefined) ?? null,
          fields: c.fields,
          createdAt: c.created_at,
          impact: impacts[i],
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof YtError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("dashboard failed", err);
    return Response.json({ error: "Couldn't load your dashboard. Please try again." }, { status: 502 });
  }
}
