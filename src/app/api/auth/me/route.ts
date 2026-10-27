import { connection } from "next/server";
import { isGoogleConfigured } from "@/lib/google-oauth";
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
      channel: s ? { id: s.channelId, title: s.channelTitle, thumbnail: s.channelThumb } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
