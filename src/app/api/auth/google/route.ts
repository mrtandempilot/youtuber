import { randomBytes } from "node:crypto";
import { connection, NextResponse } from "next/server";
import { buildAuthUrl, isGoogleConfigured } from "@/lib/google-oauth";
import { setOAuthState } from "@/lib/session";
import { absoluteUrl } from "@/lib/site";

// Starts "Connect with Google": redirects the creator to Google's consent screen.
export async function GET() {
  await connection(); // must run per request (reads/sets cookies), never prerendered
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(absoluteUrl("/youtube-channel-analyzer?error=not_configured"));
  }
  const state = randomBytes(16).toString("hex");
  await setOAuthState(state);
  return NextResponse.redirect(buildAuthUrl(state));
}
