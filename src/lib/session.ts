import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Encrypted, httpOnly cookie session holding the creator's Google tokens.
// The account itself (profile, channels, plans, history) lives in Supabase; profileId links them.

export type Session = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // ms epoch
  channelId: string | null;
  channelTitle: string | null;
  channelThumb: string | null;
  profileId?: string | null; // Supabase profiles.id (absent when the DB isn't configured)
  email?: string | null;
};

export const SESSION_COOKIE = "ck_session";
export const STATE_COOKIE = "ck_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days (refresh token keeps it alive)

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return createHash("sha256").update(secret).digest();
}

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(token: string): T | null {
  try {
    const buf = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  return raw ? unseal<Session>(raw) : null;
}

export async function writeSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, seal(s), { ...cookieOptions, maxAge: MAX_AGE });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setOAuthState(state: string) {
  (await cookies()).set(STATE_COOKIE, state, { ...cookieOptions, maxAge: 600 });
}

export async function takeOAuthState(): Promise<string | null> {
  const store = await cookies();
  const v = store.get(STATE_COOKIE)?.value ?? null;
  store.delete(STATE_COOKIE);
  return v;
}
