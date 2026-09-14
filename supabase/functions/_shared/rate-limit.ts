/**
 * Durable, cross-isolate rate limiting.
 *
 * SECURITY (remediation item 12): in-memory `Map` counters inside an edge
 * isolate are worthless as a control — the platform spins up many isolates and
 * recycles them constantly, so a caller simply retries until a cold isolate
 * serves them. Every limit here is persisted in Postgres via the existing
 * `check_otp_rate_limit` SECURITY DEFINER function (generic over `action_type`),
 * so the counter is shared by all isolates and survives restarts.
 *
 * Identity comes from `getRateLimitIdentity` (platform-trusted IP), never from
 * a client-supplied X-Forwarded-For value.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { getRateLimitIdentity } from "./client-identity.ts";

export interface RateLimitRule {
  /** Logical bucket name, e.g. "contact_form", "google_reviews". */
  action: string;
  /** Max requests per subject (email/token) inside its window. */
  subjectMax?: number;
  subjectWindowMinutes?: number;
  /** Max requests per trusted client IP inside its window. */
  ipMax?: number;
  ipWindowMinutes?: number;
  /** How long a tripped limit stays blocked. */
  blockMinutes?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
}

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/**
 * Consume one unit from the durable limiter.
 *
 * @param subject optional non-IP identity (normalised email, token hash, ...).
 *                Pass null to rate-limit purely by trusted IP.
 */
export async function enforceRateLimit(
  req: Request,
  rule: RateLimitRule,
  subject: string | null = null,
  client?: SupabaseClient,
): Promise<RateLimitResult> {
  const db = client ?? serviceClient();
  const ip = getRateLimitIdentity(req);
  try {
    const { data, error } = await db.rpc("check_otp_rate_limit", {
      p_email: subject ? subject.toLowerCase() : null,
      p_ip_address: ip,
      p_action_type: rule.action,
      p_email_max: rule.subjectMax ?? 5,
      p_email_window_minutes: rule.subjectWindowMinutes ?? 60,
      p_ip_max: rule.ipMax ?? 20,
      p_ip_window_minutes: rule.ipWindowMinutes ?? 60,
      p_block_minutes: rule.blockMinutes ?? 60,
    });
    if (error) {
      // Fail CLOSED for abuse-sensitive buckets: a broken limiter must not turn
      // into an unlimited relay.
      console.error(`[rate-limit] ${rule.action} check failed:`, error.message);
      return { allowed: false, reason: "limiter_unavailable", retryAfterSeconds: 60 };
    }
    const result = (data ?? {}) as Record<string, unknown>;
    if (result.allowed === false) {
      return {
        allowed: false,
        reason: String(result.reason ?? "rate_limited"),
        retryAfterSeconds: Number(result.retry_after_seconds ?? 60),
      };
    }
    return { allowed: true };
  } catch (e) {
    console.error(`[rate-limit] ${rule.action} threw:`, e instanceof Error ? e.message : e);
    return { allowed: false, reason: "limiter_unavailable", retryAfterSeconds: 60 };
  }
}

/** Standard 429 response (never reveals which bucket tripped). */
export function tooManyRequests(
  corsHeaders: Record<string, string>,
  result: RateLimitResult,
  message = "Too many requests. Please try again later.",
): Response {
  const retry = Math.max(1, Math.min(3600, result.retryAfterSeconds ?? 60));
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 429,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retry) },
  });
}
