/**
 * Shared CORS helper for Edge Functions.
 *
 * SECURITY (remediation item 8): the previous implementation accepted ANY
 * `https://<anything>.lovable.app` / `.lovable.dev` origin. Because anybody can
 * publish a Lovable project on that shared parent domain, that was effectively
 * an open CORS policy for attacker-controlled sites. Origins are now an
 * EXPLICIT allowlist: Massavo production domains plus this project's own
 * preview/published hosts.
 *
 * Server-to-server callers (no Origin header, e.g. Stripe webhook deliveries,
 * pg_cron jobs) keep working because ACA-Origin is only set when the incoming
 * origin is explicitly allowed.
 *
 * To allow an additional origin at runtime without a code change, set the
 * ALLOWED_ORIGINS_EXTRA env var (comma-separated, exact match only).
 */

/** Canonical Massavo production + approved Lovable-hosted origins. */
const ALLOWED_ORIGINS = new Set([
  // Production custom domains
  "https://massavo.com",
  "https://www.massavo.com",
  // Published Lovable app for this project
  "https://massavo-qr-bookings.lovable.app",
  // This project's own preview hosts (exact, project-scoped)
  "https://id-preview--369aef19-a038-49ae-a508-6d58e380afe0.lovable.app",
  "https://369aef19-a038-49ae-a508-6d58e380afe0.lovableproject.com",
  "https://preview--massavo-qr-bookings.lovable.app",
]);

// Local dev only (Vite is on :8080 per vite.config.ts but allow any port).
const DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const ALLOW_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
].join(", ");

function extraAllowed(): Set<string> {
  const raw = Deno.env.get("ALLOWED_ORIGINS_EXTRA") ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (DEV_ORIGIN_PATTERN.test(origin)) return true;
  if (extraAllowed().has(origin)) return true;
  return false;
}

/**
 * Build CORS response headers for the incoming request.
 *
 * - Allowed browser origin → reflects it in Access-Control-Allow-Origin.
 * - Missing Origin (server-to-server) → no ACA-Origin header, request still processes.
 * - Disallowed Origin → no ACA-Origin header, browser blocks the response.
 */
export interface CorsOptions {
  /** Additional request headers to allow (concatenated to the default list). */
  extraAllowHeaders?: string[];
  /** Override allowed methods (default: "POST, GET, OPTIONS"). */
  methods?: string;
}

export function buildCorsHeaders(req: Request, options: CorsOptions = {}): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowHeaders = options.extraAllowHeaders?.length
    ? `${ALLOW_HEADERS}, ${options.extraAllowHeaders.join(", ")}`
    : ALLOW_HEADERS;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": options.methods ?? "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}

/**
 * Validated origin suitable for building same-origin redirect URLs
 * (e.g. Stripe success/cancel URLs). Falls back to the canonical production
 * domain if the caller's Origin is missing or not allowlisted.
 */
export function getRedirectOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  if (origin && isAllowedOrigin(origin)) return origin;
  return "https://massavo.com";
}
