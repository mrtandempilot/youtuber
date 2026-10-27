import { revokeToken } from "@/lib/google-oauth";
import { clearSession, readSession } from "@/lib/session";

// Disconnects the channel: revokes Google access and deletes the session cookie.
export async function POST() {
  const s = await readSession();
  if (s) await revokeToken(s.refreshToken ?? s.accessToken);
  await clearSession();
  return Response.json({ ok: true });
}
