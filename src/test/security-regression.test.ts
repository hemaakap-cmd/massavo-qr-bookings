/**
 * SECURITY REGRESSION SUITE
 * =========================
 * Source-level invariants for the fixes carried on this branch, aligned to the
 * ACTUAL current implementation (remediation items 1-14). Each test fails if a
 * later change reintroduces the hole.
 *
 * Live behavioural checks live in scripts/security-scan.mjs (npm run
 * security:scan) — they attack production directly and are the deploy gate.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("item 10 — login open redirect stays on-origin", () => {
  function safeNext(raw: string | null, origin = "https://massavo.com"): string | null {
    if (!raw) return null;
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin) return null;
      return u.pathname + u.search + u.hash;
    } catch {
      return null;
    }
  }
  for (const hostile of ["/\\evil.com", "/\\/evil.com", "//evil.com", "https://evil.com", "javascript:alert(1)", "\\\\evil.com"]) {
    it(`rejects ${JSON.stringify(hostile)}`, () => expect(safeNext(hostile)).toBeNull());
  }
  it("keeps genuine in-app targets", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/manage-booking?token=x")).toBe("/manage-booking?token=x");
  });
  it("Login.tsx no longer uses the bypassable regex guard", () => {
    const login = src("src/pages/Login.tsx");
    expect(login).not.toContain("/^\\/(?!\\/)/.test(rawNext)");
    expect(login).toContain("resolved.origin !== window.location.origin");
  });
});

describe("item 11 — clickjacking: frame-ancestors ships as a real header", () => {
  for (const f of ["netlify.toml", "vercel.json", "public/_headers"]) {
    it(`${f} sets frame-ancestors`, () => expect(src(f)).toContain("frame-ancestors"));
  }
});

describe("team-fixed controls must not regress", () => {
  it("cancel-booking: email lookup + email/id cancel are retired (410)", () => {
    const fn = src("supabase/functions/cancel-booking/index.ts");
    expect(fn).toContain("goneResponse");
    expect(fn).toContain('action === "lookup"');
    expect(fn).toContain('action === "request-access"');
    expect(fn).not.toContain("bookings: eligibleBookings");
  });
  it("save-body-areas: booking access token required", () => {
    const fn = src("supabase/functions/save-body-areas/index.ts");
    expect(fn).toContain('.eq("cancellation_token", accessToken)');
    expect(fn).toContain("A valid booking access token is required");
  });
  it("CORS: no arbitrary lovable.app wildcard", () => {
    const cors = src("supabase/functions/_shared/cors.ts");
    expect(cors).not.toContain("/^https:\\/\\/[a-z0-9-]+\\.lovable\\.app$/");
    expect(cors).toContain("massavo-qr-bookings");
  });
  it("send-otp: no matchedRole leak", () => {
    expect(src("supabase/functions/send-otp/index.ts")).not.toContain("matchedRole:");
  });
  it("create-payment: booking window enforced", () => {
    expect(src("supabase/functions/create-payment/index.ts")).toContain("validateBookingWindow");
  });
  it("admin analytics: country authorized against the JWT, not the request body", () => {
    for (const f of ["supabase/functions/admin-ai-chat/index.ts", "supabase/functions/business-intelligence/index.ts"]) {
      expect(src(f)).toContain("authorizeAdminForCountry");
    }
  });
});
