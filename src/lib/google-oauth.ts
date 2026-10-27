import { absoluteUrl } from "./site";
import { readSession, writeSession, type Session } from "./session";

// Read-only scopes: identity (account), channel/videos data + private analytics.
// We never post or edit anything.
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

// Optional: lets creators apply AI suggestions (title, description, tags) straight to their videos.
// Requested only when they first click "Apply to YouTube" (incremental authorization).
export const WRITE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";

export function canWrite(scopes: string[] | undefined) {
  return Boolean(scopes?.includes(WRITE_SCOPE));
}

export const REDIRECT_PATH = "/api/auth/google/callback";

// Pages allowed as the post-login destination (prevents open redirects).
const NEXT_PAGES = ["/start", "/youtube-channel-analyzer", "/auth/done"] as const;
export function safeNext(next: string | null | undefined): string {
  return NEXT_PAGES.find((p) => p === next) ?? "/youtube-channel-analyzer";
}

function creds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  return { id, secret };
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SESSION_SECRET);
}

export function buildAuthUrl(state: string, opts: { write?: boolean } = {}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: creds().id,
    redirect_uri: absoluteUrl(REDIRECT_PATH),
    response_type: "code",
    scope: [...GOOGLE_SCOPES, ...(opts.write ? [WRITE_SCOPE] : [])].join(" "),
    access_type: "offline", // get a refresh token
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };

// Reads the Google account identity from the id_token. The token comes straight from Google's
// token endpoint over TLS, so per Google's docs its signature doesn't need re-verifying here.
export function identityFromIdToken(idToken: string | undefined) {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email_verified === false ? null : (payload.email ?? null),
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  } catch {
    return null;
  }
}

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
