import { NextResponse } from "next/server";
import { upsertAccount } from "@/lib/db";
import { exchangeCode, identityFromIdToken, safeNext } from "@/lib/google-oauth";
import { takeOAuthState, writeSession } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";
import { getChannel, YtError } from "@/lib/youtube-api";

// Google redirects here after consent. Exchanges the code, loads the creator's channel, stores the session.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const [expected, nextRaw] = ((await takeOAuthState()) ?? "").split("|");
  const back = (q: string) => NextResponse.redirect(absoluteUrl(`${safeNext(nextRaw)}${q}`));

  if (params.get("error")) return back("?error=denied");
  const code = params.get("code");
  if (!code || !expected || params.get("state") !== expected) return back("?error=state");

  try {
    const t = await exchangeCode(code);
    const granted = (t.scope ?? "").split(" ");
    if (!granted.some((s) => s.endsWith("youtube.readonly"))) return back("?error=scope");

    let channel = null;
    try {
      channel = await getChannel("mine", { accessToken: t.access_token });
    } catch (err) {
      if (err instanceof YtError && err.code === "not_found") return back("?error=no_channel");
      throw err;
    }

    // Create/update the account in Supabase. A DB problem must not block sign-in.
    const identity = identityFromIdToken(t.id_token);
    let profileId: string | null = null;
    if (identity) {
      try {
        profileId = await upsertAccount(identity, t.refresh_token ?? null, channel);
      } catch (err) {
        console.error("account upsert failed", err);
      }
    }

    await writeSession({
      scopes: granted,
      profileId,
      email: identity?.email ?? null,
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: Date.now() + t.expires_in * 1000,
      channelId: channel.id,
      channelTitle: channel.title,
      channelThumb: channel.thumbnail,
    });
    return back("?connected=1");
  } catch (err) {
    console.error("google oauth callback failed", err);
    return back("?error=oauth");
  }
}
