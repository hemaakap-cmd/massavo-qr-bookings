/**
 * Safe error responses.
 *
 * SECURITY (remediation item 14): public endpoints were returning raw
 * `error.message` / stack text from Postgres, Stripe and Resend. Those strings
 * leak table names, constraint names, RPC signatures and internal hostnames,
 * which is exactly the reconnaissance an attacker needs.
 *
 * Pattern: log the full detail server-side (visible in function logs), return a
 * short generic message plus a correlation id the user can quote to support.
 */

export function newCorrelationId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Log full detail, return a sanitised JSON error response.
 *
 * @param publicMessage a message that is safe to show a stranger.
 */
export function safeErrorResponse(
  corsHeaders: Record<string, string>,
  scope: string,
  detail: unknown,
  publicMessage = "An unexpected error occurred. Please try again.",
  status = 500,
): Response {
  const ref = newCorrelationId();
  const message = detail instanceof Error ? `${detail.message}\n${detail.stack ?? ""}` : String(detail);
  console.error(`[${scope}][ref=${ref}]`, message);
  return new Response(JSON.stringify({ success: false, error: publicMessage, ref }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Client-error response (4xx): message is author-controlled, so safe by construction. */
export function clientErrorResponse(
  corsHeaders: Record<string, string>,
  publicMessage: string,
  status = 400,
): Response {
  return new Response(JSON.stringify({ success: false, error: publicMessage }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** 410 Gone — used to retire insecure legacy API contracts. */
export function goneResponse(
  corsHeaders: Record<string, string>,
  publicMessage = "This endpoint has been retired for security reasons.",
): Response {
  return new Response(JSON.stringify({ success: false, error: publicMessage, retired: true }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
