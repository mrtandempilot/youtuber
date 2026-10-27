import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ChannelStats } from "./channel-analysis";
import { seal } from "./session";
import type { Channel, ChannelAnalytics } from "./youtube-api";

// Server-only Supabase access with the secret key (bypasses RLS; tables have no public policies).
// Everything here is optional: without SUPABASE_URL / SUPABASE_SECRET_KEY the site keeps working
// and simply doesn't persist accounts, plans or history.

let client: SupabaseClient | null | undefined;

export function db(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

export const isDbConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export type GoogleIdentity = { sub: string; email: string | null; name: string | null; picture: string | null };

// Called after Google sign-in. Creates/updates the profile and channel; returns the profile id.
export async function upsertAccount(identity: GoogleIdentity, refreshToken: string | null, channel: Channel) {
  const d = db();
  if (!d) return null;

  const profile = check(
    await d
      .from("profiles")
      .upsert(
        {
          google_sub: identity.sub,
          email: identity.email,
          name: identity.name,
          avatar_url: identity.picture,
          last_login_at: new Date().toISOString(),
          // Google only returns a refresh token on consent; keep the old one otherwise.
          ...(refreshToken ? { refresh_token_enc: seal(refreshToken) } : {}),
        },
        { onConflict: "google_sub" },
      )
      .select("id")
      .single(),
    "upsert profile",
  ) as { id: string };

  await upsertChannel(profile.id, channel);
  return profile.id;
}

export async function upsertChannel(profileId: string, channel: Channel) {
  const d = db();
  if (!d) return;
  check(
    await d.from("channels").upsert(
      {
        id: channel.id,
        profile_id: profileId,
        title: channel.title,
        handle: channel.handle,
        thumbnail_url: channel.thumbnail,
        subscribers: channel.subscribers,
        views: channel.views,
        video_count: channel.videoCount,
      },
      { onConflict: "id" },
    ),
    "upsert channel",
  );
}

// One row per channel per day (later analyses the same day overwrite it).
export async function saveSnapshot(channel: Channel, stats: ChannelStats, analytics: ChannelAnalytics | null) {
  const d = db();
  if (!d) return;
  check(
    await d.from("channel_snapshots").upsert(
      {
        channel_id: channel.id,
        day: new Date().toISOString().slice(0, 10),
        subscribers: channel.subscribers,
        views: channel.views,
        video_count: channel.videoCount,
        median_views_per_day: stats.medianViewsPerDay,
        uploads_per_week: stats.uploadsPerWeek,
        engagement_rate: stats.avgEngagementRate,
        analytics: analytics ? { periodDays: analytics.periodDays, totals: analytics.totals } : null,
      },
      { onConflict: "channel_id,day" },
    ),
    "save snapshot",
  );
}

export type PlanInput = {
  goal: string;
  niche: string;
  videosPerWeek: number;
  format: string;
  plan: unknown;
  stats: unknown;
};

export async function savePlan(profileId: string, channelId: string, p: PlanInput) {
  const d = db();
  if (!d) return null;
  const row = check(
    await d
      .from("plans")
      .insert({
        profile_id: profileId,
        channel_id: channelId,
        goal: p.goal,
        niche: p.niche || null,
        videos_per_week: p.videosPerWeek,
        format: p.format,
        plan: p.plan,
        stats: p.stats,
      })
      .select("id, created_at")
      .single(),
    "save plan",
  );
  return row as { id: string; created_at: string };
}

export async function latestPlan(profileId: string, channelId: string) {
  const d = db();
  if (!d) return null;
  const res = await d
    .from("plans")
    .select("id, goal, niche, videos_per_week, format, plan, stats, created_at")
    .eq("profile_id", profileId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return check(res, "latest plan");
}

export async function snapshotHistory(channelId: string, days = 90) {
  const d = db();
  if (!d) return [];
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const res = await d
    .from("channel_snapshots")
    .select("day, subscribers, views, median_views_per_day")
    .eq("channel_id", channelId)
    .gte("day", since)
    .order("day");
  return check(res, "snapshot history") ?? [];
}

// GDPR / Google API policy: deleting the profile cascades to channels, plans and snapshots.
export async function deleteAccount(profileId: string) {
  const d = db();
  if (!d) return;
  check(await d.from("profiles").delete().eq("id", profileId), "delete account");
}
