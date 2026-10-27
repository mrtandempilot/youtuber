import { connection } from "next/server";
import { canWrite, isGoogleConfigured } from "@/lib/google-oauth";
import { readSession } from "@/lib/session";

// Lets the (static) analyzer page know whether a channel is connected.
export async function GET() {
  await connection(); // must run per request (reads/sets cookies), never prerendered
  const configured = isGoogleConfigured();
  const s = configured ? await readSession() : null;
  return Response.json(
    {
      googleConfigured: configured,
      connected: Boolean(s),
      account: Boolean(s?.profileId), // signed in with a saved account (Supabase)
      canWrite: canWrite(s?.scopes), // granted permission to edit videos
      email: s?.email ?? null,
      channel: s ? { id: s.channelId, title: s.channelTitle, thumbnail: s.channelThumb } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
