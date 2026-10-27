import { absoluteUrl } from "./site";
import { readSession, writeSession, type Session } from "./session";

// Read-only scopes: channel/videos data + private analytics. We never post or edit anything.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export const REDIRECT_PATH = "/api/auth/google/callback";

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { id, secret };
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET);
}

export function buildAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: absoluteUrl(REDIRECT_PATH),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline", // get a refresh token
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = creds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...body }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: absoluteUrl(REDIRECT_PATH) });
}

export async function revokeToken(token: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(
    () => undefined,
  );
}

// Returns a valid session, refreshing the access token if it expires within a minute.
export async function getFreshSession(): Promise<Session | null> {
  const s = await readSession();
  if (!s) return null;
  if (s.expiresAt - Date.now() > 60_000) return s;
  if (!s.refreshToken) return null;
  try {
    const t = await tokenRequest({ refresh_token: s.refreshToken, grant_type: "refresh_token" });
    const next: Session = { ...s, accessToken: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
    await writeSession(next);
    return next;
  } catch {
    return null;
  }
}
