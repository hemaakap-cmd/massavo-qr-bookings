/**
 * Strict same-origin redirect validation.
 *
 * SECURITY (remediation item 9): the login page validated its `next` parameter
 * with `/^\/(?!\/)/` and then assigned it to `window.location.href`. That regex
 * only rejects a literal `//`, so every one of these slipped through and sent the
 * freshly-authenticated user (and any token in the URL) to an attacker host:
 *
 *   /\evil.com        browsers normalise the backslash to "/" -> //evil.com
 *   /%2f%2fevil.com   percent-decoded by the navigation, not by the regex
 *   /%5cevil.com      decodes to a backslash, same as above
 *   /\/evil.com       mixed separators
 *
 * Instead of pattern-matching the string, resolve it against the current origin
 * with the URL parser — the same parser the browser will use — and accept the
 * result only when it stays on this exact origin. Anything else returns null and
 * the caller falls back to a known-safe route.
 */

const MAX_TARGET_LENGTH = 512;

/**
 * @returns a safe same-origin path (always starting with a single "/"), or null.
 */
export function safeRedirectPath(raw: unknown, origin: string = window.location.origin): string | null {
  if (typeof raw !== "string") return null;

  const candidate = raw.trim();
  if (!candidate || candidate.length > MAX_TARGET_LENGTH) return null;

  // Must be a relative path. Reject anything carrying a scheme, an authority,
  // or a separator the browser would treat as the start of an authority — in
  // raw OR encoded form, since the navigation decodes before we would see it.
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (/[\\]/.test(candidate)) return null;
  if (/%2f/i.test(candidate.slice(0, 8)) || /%5c/i.test(candidate.slice(0, 8))) return null;
  if (/^\/[\t\n\r ]*[\\/]/.test(candidate)) return null;
  // Control characters (incl. NUL/tab/newline) are stripped by the parser and
  // can smuggle an authority past naive checks.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;

  let resolved: URL;
  try {
    resolved = new URL(candidate, origin);
  } catch {
    return null;
  }

  // The parser is the authority: after resolution the origin must be unchanged.
  if (resolved.origin !== new URL(origin).origin) return null;
  if (!resolved.pathname.startsWith("/") || resolved.pathname.startsWith("//")) return null;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
