import { deleteAccount } from "@/lib/db";
import { revokeToken } from "@/lib/google-oauth";
import { clearSession, readSession } from "@/lib/session";

// Deletes everything we store about the creator: profile, channels, plans, history
// (cascade), revokes Google access and signs them out.
export async function POST() {
  const s = await readSession();
  if (!s) return Response.json({ ok: true });
  try {
    if (s.profileId) await deleteAccount(s.profileId);
  } catch (err) {
    console.error("delete account failed", err);
    return Response.json({ error: "Couldn't delete your data. Please try again." }, { status: 502 });
  }
  await revokeToken(s.refreshToken ?? s.accessToken);
  await clearSession();
  return Response.json({ ok: true });
}
