/**
 * Server-side QR / venue authorization tokens (N-2).
 *
 * A venue token proves that the caller passed through the server-side QR entry
 * point for ONE specific venue. It is:
 *  - HMAC-SHA256 signed with VENUE_QR_TOKEN_SECRET (server-only secret)
 *  - scoped to exactly one venue_type + venue_id
 *  - short lived (revocation: expiry + venue is_active re-check on every use)
 *  - free of prices, service catalogue or any other sensitive payload
 *
 * Changing the venue id inside the token invalidates the signature, so a token
 * for Gym A can never be replayed against Gym B or a hotel.
 */

export type TokenVenueType = "gym" | "hotel";

export interface VenueTokenPayload {
  /** venue type */
  t: TokenVenueType;
  /** venue id */
  v: string;
  /** issued at (unix seconds) */
  iat: number;
  /** expires at (unix seconds) */
  exp: number;
  /** random token id */
  jti: string;
}

/** Token lifetime: long enough for a full booking funnel, short enough to expire. */
export const VENUE_TOKEN_TTL_SECONDS = 60 * 60 * 2;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function key(): Promise<CryptoKey> {
  const secret = Deno.env.get("VENUE_QR_TOKEN_SECRET");
  if (!secret) throw new Error("VENUE_QR_TOKEN_SECRET is not configured");
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issueVenueToken(venueType: TokenVenueType, venueId: string): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: VenueTokenPayload = {
    t: venueType,
    v: venueId,
    iat: now,
    exp: now + VENUE_TOKEN_TTL_SECONDS,
    jti: crypto.randomUUID(),
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return { token: `${body}.${b64url(sig)}`, expiresAt: payload.exp };
}

export type VenueTokenError = "missing" | "malformed" | "bad_signature" | "expired" | "venue_mismatch";

export interface VerifyResult {
  ok: boolean;
  payload?: VenueTokenPayload;
  error?: VenueTokenError;
}

/**
 * Verifies signature + expiry and, when expected values are supplied, that the
 * token was issued for exactly that venue. Any mismatch is a hard failure.
 */
export async function verifyVenueToken(
  token: string | null | undefined,
  expected?: { venueType?: string | null; venueId?: string | null },
): Promise<VerifyResult> {
  if (!token || typeof token !== "string") return { ok: false, error: "missing" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, error: "malformed" };

  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", await key(), b64urlDecode(parts[1]), enc.encode(parts[0]));
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!valid) return { ok: false, error: "bad_signature" };

  let payload: VenueTokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))) as VenueTokenPayload;
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (payload.t !== "gym" && payload.t !== "hotel") return { ok: false, error: "malformed" };
  if (typeof payload.v !== "string" || !payload.v) return { ok: false, error: "malformed" };
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return { ok: false, error: "expired" };

  if (expected?.venueType && expected.venueType !== payload.t) return { ok: false, error: "venue_mismatch" };
  if (expected?.venueId && expected.venueId !== payload.v) return { ok: false, error: "venue_mismatch" };

  return { ok: true, payload };
}

/**
 * Revocation check: a venue token is only usable while the venue itself is
 * still present and active. Disabling or deleting a venue invalidates every
 * token that was issued for it.
 */
export async function venueStillActive(
  supabase: { from: (t: string) => any },
  venueType: TokenVenueType,
  venueId: string,
): Promise<boolean> {
  const table = venueType === "hotel" ? "hotels" : "gyms";
  const { data } = await supabase.from(table).select("id, is_active").eq("id", venueId).maybeSingle();
  return !!data && data.is_active === true;
}
