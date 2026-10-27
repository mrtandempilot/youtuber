import { connection } from "next/server";
import { isDbConfigured, latestPlan, savePlan } from "@/lib/db";
import { readSession } from "@/lib/session";

const GOALS = ["views", "subscribers", "monetize", "shorts", "search"];
const FORMATS = ["long", "short", "mixed"];

// GET  → the connected creator's latest saved plan (or null)
// POST → save a plan made in the onboarding wizard to the creator's account
export async function GET() {
  await connection();
  const s = await readSession();
  if (!s?.profileId || !s.channelId || !isDbConfigured()) {
    return Response.json({ plan: null, saved: false }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const row = await latestPlan(s.profileId, s.channelId);
    return Response.json({ plan: row, saved: Boolean(row) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("load plan failed", err);
    return Response.json({ plan: null, saved: false });
  }
}

export async function POST(request: Request) {
  const s = await readSession();
  if (!s?.profileId || !s.channelId) {
    return Response.json({ saved: false, reason: "not_signed_in" });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const goal = String(body.goal ?? "");
  const format = String(body.format ?? "mixed");
  if (!GOALS.includes(goal) || !FORMATS.includes(format) || typeof body.plan !== "object" || !body.plan) {
    return Response.json({ error: "Invalid plan." }, { status: 400 });
  }
  const json = JSON.stringify(body.plan);
  if (json.length > 50_000) return Response.json({ error: "Plan too large." }, { status: 413 });

  try {
    const row = await savePlan(s.profileId, s.channelId, {
      goal,
      format,
      niche: typeof body.niche === "string" ? body.niche.slice(0, 200) : "",
      videosPerWeek: Math.min(Math.max(Number(body.videosPerWeek) || 1, 1), 14),
      plan: body.plan,
      stats: body.stats ?? null,
    });
    return Response.json({ saved: Boolean(row), id: row?.id ?? null });
  } catch (err) {
    console.error("save plan failed", err);
    return Response.json({ saved: false, error: "Couldn't save your plan." }, { status: 502 });
  }
}
