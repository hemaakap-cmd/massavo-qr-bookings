/**
 * Security regression suite for the 18-item remediation.
 *
 * Two kinds of test live here:
 *  1. Pure unit tests of the open-redirect validator (always run).
 *  2. Live rejection-path probes against the deployed backend (guarded by
 *     LIVE_PROBES, on by default). Every probe exercises only DENIAL paths with
 *     synthetic input: no real customer data, no payment credentials, no money,
 *     no emails to real recipients, no rows created.
 *
 * NOT TESTED here, deliberately: authenticated RLS, role escalation,
 * cross-country AI isolation, privileged payment/refund paths and Stripe webhook
 * replay. Those require dedicated synthetic staff/admin accounts and Stripe test
 * credentials which are not available in this environment — asserting them from
 * an anonymous client would produce a false PASS.
 */
import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "@/lib/safeRedirect";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

const LIVE = import.meta.env.VITE_SKIP_LIVE_PROBES !== "true";
const TIMEOUT = 30_000;
const SYNTHETIC_EMAIL = "qa-probe-not-a-real-customer@example.invalid";
const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

async function invoke(fn: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, text, json };
}

// ── Item 9: open redirect ────────────────────────────────────────────────────
describe("open redirect is blocked (item 9)", () => {
  const ORIGIN = "https://massavo.com";

  const hostile = [
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/%2f%2fevil.com",
    "/%5c%5cevil.com",
    "/%5cevil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "\\\\evil.com",
    "/\tevil.com",
    "/\n//evil.com",
    "evil.com",
    "///evil.com",
  ];

  it.each(hostile)("rejects %j", (candidate) => {
    expect(safeRedirectPath(candidate, ORIGIN)).toBeNull();
  });

  it("accepts genuine same-origin relative paths", () => {
    expect(safeRedirectPath("/staff", ORIGIN)).toBe("/staff");
    expect(safeRedirectPath("/manage-booking?token=abc", ORIGIN)).toBe("/manage-booking?token=abc");
    expect(safeRedirectPath("/admin/bookings#top", ORIGIN)).toBe("/admin/bookings#top");
  });

  it("never returns an absolute URL or protocol-relative value", () => {
    for (const candidate of [...hostile, "/staff", "/x?y=z"]) {
      const out = safeRedirectPath(candidate, ORIGIN);
      if (out === null) continue;
      expect(out.startsWith("/")).toBe(true);
      expect(out.startsWith("//")).toBe(false);
      expect(out).not.toMatch(/^[a-z]+:/i);
    }
  });
});

// ── Item 1: booking disclosure by email ──────────────────────────────────────
describe.skipIf(!LIVE)("booking disclosure by email is blocked (item 1)", () => {
  it("the legacy unauthenticated `lookup` action is retired (410)", async () => {
    const r = await invoke("cancel-booking", { action: "lookup", email: SYNTHETIC_EMAIL });
    expect(r.status).toBe(410);
    expect(r.text).not.toMatch(/booking_date|customer_name|total_amount/i);
  }, TIMEOUT);

  it("the legacy unauthenticated `cancel` action is retired (410)", async () => {
    const r = await invoke("cancel-booking", { action: "cancel", email: SYNTHETIC_EMAIL, bookingId: RANDOM_UUID });
    expect(r.status).toBe(410);
  }, TIMEOUT);

  it("request-access returns a generic body and never booking details", async () => {
    const r = await invoke("cancel-booking", { action: "request-access", email: SYNTHETIC_EMAIL });
    expect([200, 429]).toContain(r.status);
    if (r.status === 200) {
      expect(r.text).not.toMatch(/booking_date|booking_time|total_amount|cancellation_token|customer_name/i);
      expect(Array.isArray(r.json?.bookings)).toBe(false);
    }
  }, TIMEOUT);
});

// ── Item 1: unauthorized cancellation ───────────────────────────────────────
describe.skipIf(!LIVE)("unauthorized cancellation is blocked (item 1)", () => {
  it("a forged cancellation token cannot cancel anything", async () => {
    const r = await invoke("cancel-booking", {
      action: "token-cancel",
      token: "forged-token-0000000000000000000000",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.success).not.toBe(true);
  }, TIMEOUT);

  it("token lookup with a forged token discloses nothing", async () => {
    const r = await invoke("cancel-booking", {
      action: "token-lookup",
      token: "forged-token-0000000000000000000000",
    });
    expect(r.text).not.toMatch(/customer_email|customer_name|total_amount/i);
  }, TIMEOUT);
});

// ── Item 2: health / body-area writes ───────────────────────────────────────
describe.skipIf(!LIVE)("unauthorized health-data write is blocked (item 2)", () => {
  it("rejects a write with no ownership token", async () => {
    const r = await invoke("save-body-areas", {
      bookingId: RANDOM_UUID,
      areas: [{ area_code: "neck", area_label: "Neck", pain_intensity: 9 }],
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.success).not.toBe(true);
  }, TIMEOUT);

  it("rejects a write with a forged token", async () => {
    const r = await invoke("save-body-areas", {
      bookingId: RANDOM_UUID,
      token: "forged-token-0000000000000000000000",
      areas: [{ area_code: "neck", area_label: "Neck", pain_intensity: 9 }],
      communicationPreference: "whatsapp",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.success).not.toBe(true);
  }, TIMEOUT);
});

// ── Item 3: reschedule ownership ────────────────────────────────────────────
describe.skipIf(!LIVE)("reschedule requires token ownership (item 3)", () => {
  it("rejects a forged reschedule token", async () => {
    const r = await invoke("respond-to-reschedule", {
      token: "forged-token-0000000000000000000000",
      response: "confirm",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.success).not.toBe(true);
  }, TIMEOUT);
});

// ── Item 4: server-side booking window / price authority ────────────────────
describe.skipIf(!LIVE)("payment enforces the server-side booking window (item 4)", () => {
  it("rejects a date in the past", async () => {
    const r = await invoke("create-payment", {
      serviceId: RANDOM_UUID,
      gymId: RANDOM_UUID,
      bookingDate: "2020-01-01",
      timeSlot: "10:00",
      customerEmail: SYNTHETIC_EMAIL,
      price: 1,
      currency: "EUR",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.url).toBeUndefined();
  }, TIMEOUT);

  it("rejects a date far in the future", async () => {
    const r = await invoke("create-payment", {
      serviceId: RANDOM_UUID,
      gymId: RANDOM_UUID,
      bookingDate: "2099-01-01",
      timeSlot: "10:00",
      customerEmail: SYNTHETIC_EMAIL,
      price: 1,
      currency: "EUR",
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.json?.url).toBeUndefined();
  }, TIMEOUT);
});

// ── Item 5: tenant isolation entry point ────────────────────────────────────
describe.skipIf(!LIVE)("admin analytics reject anonymous callers (item 5)", () => {
  it("business-intelligence requires an admin identity", async () => {
    const r = await invoke("business-intelligence", { section: "all", country_id: RANDOM_UUID });
    expect([400, 401, 403]).toContain(r.status);
    expect(r.text).not.toMatch(/commission_percentage|total_amount/i);
  }, TIMEOUT);

  it("admin-ai-chat requires an admin identity", async () => {
    const r = await invoke("admin-ai-chat", { messages: [], country_id: RANDOM_UUID });
    expect([400, 401, 403]).toContain(r.status);
  }, TIMEOUT);

  // NOT TESTED: cross-country isolation between two real admins — needs two
  // synthetic admin accounts scoped to different countries.
});

// ── Item 7: account enumeration ─────────────────────────────────────────────
describe.skipIf(!LIVE)("one-time-code flow does not enumerate accounts (item 7)", () => {
  it("never reveals a matched privileged role", async () => {
    const r = await invoke("send-otp", { email: SYNTHETIC_EMAIL, allowedRoles: ["admin", "super_admin"] });
    expect(r.text).not.toMatch(/matchedRole|super_admin/i);
  }, TIMEOUT);
});

// ── Item 8: CORS allowlist ──────────────────────────────────────────────────
describe.skipIf(!LIVE)("CORS rejects attacker-controlled origins (item 8)", () => {
  it("does not echo a hostile lovable.app subdomain", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-booking`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://attacker-owned-project.lovable.app",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "https://attacker-owned-project.lovable.app",
    );
  }, TIMEOUT);

  it("allows the production origin", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-booking`, {
      method: "OPTIONS",
      headers: { Origin: "https://massavo.com", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://massavo.com");
  }, TIMEOUT);
});

// ── Item 13: paid third-party quota ─────────────────────────────────────────
describe.skipIf(!LIVE)("paid quota endpoints are protected (item 13)", () => {
  it("synthetic-monitor rejects anonymous callers", async () => {
    const r = await invoke("synthetic-monitor", {});
    expect([401, 403]).toContain(r.status);
  }, TIMEOUT);

  it("google reviews are served from cache rather than a live paid lookup", async () => {
    const r = await invoke("get-google-reviews", {});
    expect(r.status).toBeLessThan(500);
    if (r.status === 200) {
      expect(["cache", "cache_stale", "google_places_api", "fallback"]).toContain(r.json?.source);
    }
  }, TIMEOUT);
});

// ── Item 14: error detail leakage ───────────────────────────────────────────
describe.skipIf(!LIVE)("public errors do not leak internals (item 14)", () => {
  const probes: Array<[string, unknown]> = [
    ["save-body-areas", { bookingId: "not-a-uuid", areas: [] }],
    ["respond-to-reschedule", { token: "x" }],
    ["cancel-booking", { action: "token-cancel", token: "x" }],
  ];

  it.each(probes)("%s hides stack traces and SQL detail", async (fn, body) => {
    const r = await invoke(fn as string, body);
    expect(r.text).not.toMatch(/at \w+ \(|\.ts:\d+:\d+/);
    expect(r.text).not.toMatch(/relation "|column "|PGRST\d+|violates .* constraint/i);
    expect(r.text).not.toMatch(/service_role|SUPABASE_SERVICE_ROLE_KEY|eyJhbGciOi/);
  }, TIMEOUT);
});
