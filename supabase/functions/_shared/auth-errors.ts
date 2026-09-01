/**
 * Correct HTTP status codes for auth/authorization failures.
 *
 * Several admin edge functions signal auth failures by throwing
 * (`throw new Error("Not authenticated")` / `"Unauthorized: admin role required"`)
 * and their outer catch mapped EVERYTHING to 500. That made a rejected
 * anonymous caller indistinguishable from a genuine server crash:
 *   - monitoring/alerting counts routine auth rejections as 5xx noise, which
 *     masks real outages,
 *   - clients cannot tell "log in" from "the server is broken".
 *
 * This maps those thrown auth errors onto the status they should always have
 * had. It does NOT change any authorization logic — rejection still happens in
 * exactly the same place, it is only reported honestly.
 */

/** 401 = not authenticated. 403 = authenticated but lacking the role. */
export function statusForError(err: unknown): number {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/^not authenticated$/i.test(message.trim())) return 401;
  if (/^unauthorized\b/i.test(message.trim())) return 403;
  return 500;
}

/** Safe message for the client: auth errors are already generic, others are masked. */
export function messageForError(err: unknown): string {
  const status = statusForError(err);
  if (status === 401) return "Not authenticated";
  if (status === 403) return err instanceof Error ? err.message : "Unauthorized";
  // Never leak internal failure details on a real 500.
  return "Internal server error";
}
