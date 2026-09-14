/**
 * Trusted client identity helpers.
 *
 * SECURITY (remediation item 12): rate limiting must never key on the LEFTMOST
 * `X-Forwarded-For` entry. That value is whatever the client sent, so an
 * attacker rotates it per request and bypasses every limit.
 *
 * The edge platform (Cloudflare/Fly in front of the Deno isolate) sets
 * `cf-connecting-ip` / `x-real-ip` itself and APPENDS the real peer address to
 * the end of `x-forwarded-for`. So we prefer the platform headers, and when we
 * fall back to XFF we take the RIGHTMOST entry — the hop closest to us, which
 * the client cannot forge.
 */

/** Platform-set headers, in order of trustworthiness. */
const TRUSTED_IP_HEADERS = ["cf-connecting-ip", "x-real-ip", "fly-client-ip", "true-client-ip"];

function isPlausibleIp(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return v.split(".").every((o) => Number(o) <= 255);
  // IPv6 (loose)
  return /^[0-9a-f:]+$/i.test(v) && v.includes(":");
}

/**
 * Best-effort trusted client IP. Returns null when nothing trustworthy exists
 * (callers should then fall back to a non-IP identity such as the email/token).
 */
export function getTrustedClientIp(req: Request): string | null {
  for (const header of TRUSTED_IP_HEADERS) {
    const value = req.headers.get(header)?.trim();
    if (value && isPlausibleIp(value)) return value;
  }
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    // RIGHTMOST hop = added by our own infrastructure, not client-controlled.
    for (let i = parts.length - 1; i >= 0; i--) {
      if (isPlausibleIp(parts[i])) return parts[i];
    }
  }
  return null;
}

/**
 * Stable identity string for rate-limit keys. Never returns a client-controlled
 * value on its own — falls back to a constant bucket so limits still apply
 * (shared/global bucket) instead of silently disabling protection.
 */
export function getRateLimitIdentity(req: Request): string {
  return getTrustedClientIp(req) ?? "unknown-peer";
}
