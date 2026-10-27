import { randomBytes } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured, safeNext } from "@/lib/google-oauth";
import { setOAuthState } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";

// Starts "Connect with Google": redirects the creator to Google's consent screen.
// ?next=/start brings them back to the onboarding wizard afterwards.
export async function GET(request: Request) {
  await connection(); // must run per request (reads/sets cookies), never prerendered
  const params = new URL(request.url).searchParams;
  const next = safeNext(params.get("next"));
  const write = params.get("write") === "1";
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(absoluteUrl(`${next}?error=not_configured`));
  }
  const state = randomBytes(16).toString("hex");
  await setOAuthState(`${state}|${next}`);
  return NextResponse.redirect(buildAuthUrl(state, { write }));
}
