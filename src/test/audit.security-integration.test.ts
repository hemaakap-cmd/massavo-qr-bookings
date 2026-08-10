/**
 * FULL-STACK SECURITY & INTEGRATION AUDIT (read-only / rejection-path only).
 *
 * These probes actively try to BREAK the system across the layer boundaries:
 *   Frontend anon client → Supabase RLS/RPC → Edge Functions → validation.
 *
 * Everything here is safe to run against production:
 *   - No bookings are created (only rejection/validation paths are exercised).
 *   - No emails/SMS are sent (edge functions are hit only with invalid input
 *     that fails validation before any side effect).
 *   - No mutations succeed (we assert that they are DENIED).
 *
 * The point is to prove the SECURITY boundary holds, not to reach happy paths.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TIMEOUT = 25_000;
const RANDOM_UUID = "00000000-0000-4000-8000-000000000000";

async function invoke(fn: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, json, text };
}

/* ====================================================================
 * A. RLS — SENSITIVE TABLES MUST BE ANON-INVISIBLE
 * ================================================================== */
describe("AUDIT A — RLS read denial on sensitive tables", () => {
  const sensitive = [
    "bookings",
    "profiles",
    "user_roles",
    "therapist_private_info",
    "country_financials",
    "clinical_access_logs",
    "admin_audit_log",
    "gdpr_audit_log",
    "otp_attempts",
    "stripe_webhook_events",
    "booking_feedback",
    "therapist_attendance",
    "system_incidents",
    "edge_function_failures",
  ];

  for (const table of sensitive) {
    it(
      `anon cannot read rows from ${table}`,
      async () => {
        const { data, error } = await sb.from(table as any).select("*").limit(1);
        // Either RLS errors, or (more commonly) returns an empty set. Never rows.
        if (error) {
          expect(error).toBeTruthy();
        } else {
          expect(Array.isArray(data)).toBe(true);
          expect((data || []).length).toBe(0);
        }
      },
      TIMEOUT,
    );
  }
});

/* ====================================================================
 * B. RLS — WRITE DENIAL (anon must not mutate anything)
 * ================================================================== */
describe("AUDIT B — RLS write denial", () => {
  it(
    "anon cannot INSERT a booking directly (must go through paid flow)",
    async () => {
      const { data, error } = await sb.from("bookings").insert({
        customer_email: "attacker@example.com",
        booking_date: "2099-01-01",
        booking_time: "10:00",
        status: "confirmed",
        payment_status: "paid",
      } as any).select();
      expect(error).toBeTruthy();
      expect(data == null || (data as any[]).length === 0).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "anon cannot UPDATE a service price (price tampering at the DB layer)",
    async () => {
      const { data, error } = await sb
        .from("services")
        .update({ price: 1 } as any)
        .neq("id", RANDOM_UUID)
        .select();
      // Update must affect zero rows or be rejected outright.
      if (!error) expect((data || []).length).toBe(0);
      else expect(error).toBeTruthy();
    },
    TIMEOUT,
  );

  it(
    "anon cannot self-assign an admin role via user_roles insert",
    async () => {
      const { data, error } = await sb.from("user_roles").insert({
        user_id: RANDOM_UUID,
        role: "super_admin",
      } as any).select();
      expect(error).toBeTruthy();
      expect(data == null || (data as any[]).length === 0).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "anon cannot INSERT a country_financials row",
    async () => {
      const { data, error } = await sb.from("country_financials").insert({
        country_id: RANDOM_UUID,
      } as any).select();
      expect(error).toBeTruthy();
      expect(data == null || (data as any[]).length === 0).toBe(true);
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * C. PUBLIC CATALOG — only ACTIVE rows leak to anon
 * ================================================================== */
describe("AUDIT C — public catalog exposure is scoped to active rows", () => {
  it(
    "gyms: every anon-visible row is active",
    async () => {
      const { data, error } = await sb.from("gyms").select("id, is_active").limit(50);
      expect(error).toBeNull();
      for (const g of data || []) expect(g.is_active).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "hotels: every anon-visible row is active",
    async () => {
      const { data, error } = await sb.from("hotels").select("id, is_active").limit(50);
      expect(error).toBeNull();
      for (const h of data || []) expect(h.is_active).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "services: no sub-€5 hidden/test service is publicly visible",
    async () => {
      const { data, error } = await sb.from("services").select("id, price, is_active").limit(100);
      expect(error).toBeNull();
      for (const s of data || []) {
        expect(s.is_active).toBe(true);
        if (typeof s.price === "number") expect(s.price).toBeGreaterThanOrEqual(5);
      }
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * D. QR RESOLUTION — invalid/inactive QR must not resolve to private data
 * ================================================================== */
describe("AUDIT D — QR entry-point integrity", () => {
  it(
    "a bogus qr_code_id resolves to no gym",
    async () => {
      const { data, error } = await sb
        .from("gyms")
        .select("id, name, qr_code_id, is_active")
        .eq("qr_code_id", "definitely-not-a-real-qr-code-xyz-123")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "a bogus qr_code_id resolves to no hotel",
    async () => {
      const { data, error } = await sb
        .from("hotels")
        .select("id, name, qr_code_id, is_active")
        .eq("qr_code_id", "definitely-not-a-real-qr-code-xyz-123")
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "resolve_venue RPC is deployed with its real (_venue_id,_venue_type) signature",
    async () => {
      // resolve_venue resolves a KNOWN venue by id+type (not a QR lookup).
      // A non-existent id must not error at the schema level and must not
      // return a real venue.
      const { data, error } = await sb.rpc("resolve_venue" as any, {
        _venue_id: RANDOM_UUID,
        _venue_type: "gym",
      });
      if (error) {
        expect(error.message).not.toMatch(/does not exist|schema cache/i);
      } else {
        // Bogus id → null / empty json, never a populated venue.
        expect(data == null || data === "" || Object.keys(data as object).length === 0).toBe(true);
      }
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * E. MULTI-COUNTRY ISOLATION
 * ================================================================== */
describe("AUDIT E — multi-country data isolation", () => {
  it(
    "cities carry a country_id so the frontend can scope by country",
    async () => {
      const { data, error } = await sb
        .from("cities")
        .select("id, country_id, is_active")
        .eq("is_active", true)
        .limit(20);
      expect(error).toBeNull();
      for (const c of data || []) expect(c.country_id).toBeTruthy();
    },
    TIMEOUT,
  );

  it(
    "filtering gyms by a non-existent country returns an empty set (no leak)",
    async () => {
      const { data, error } = await sb
        .from("gyms")
        .select("id")
        .eq("country_id", RANDOM_UUID)
        .limit(5);
      expect(error).toBeNull();
      expect((data || []).length).toBe(0);
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * F. EDGE FUNCTION VALIDATION / REJECTION PATHS
 *    (invalid input must be rejected BEFORE any side effect)
 * ================================================================== */
describe("AUDIT F — edge function input validation", () => {
  it(
    "create-payment rejects a missing serviceId",
    async () => {
      const { status, json } = await invoke("create-payment", { customerEmail: "a@b.com" });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "create-payment rejects an invalid email even with a UUID service id",
    async () => {
      const { status, json } = await invoke("create-payment", {
        serviceId: RANDOM_UUID,
        customerEmail: "not-an-email",
      });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "create-payment never returns a checkout URL for a non-existent service",
    async () => {
      const { json } = await invoke("create-payment", {
        serviceId: RANDOM_UUID,
        customerEmail: "valid@example.com",
        venueType: "gym",
      });
      // No real service → no Stripe URL. (Price is server-derived; a fake
      // service can never yield a payable session.)
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "manage-booking rejects a malformed/invalid token",
    async () => {
      const { status, json } = await invoke("manage-booking", { token: "x", action: "get" });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(json?.booking).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "cancel-booking token-lookup rejects a malformed token",
    async () => {
      const { status } = await invoke("cancel-booking", { action: "token-lookup", token: "x" });
      expect(status).toBeGreaterThanOrEqual(400);
    },
    TIMEOUT,
  );

  it(
    "respond-to-reschedule rejects an unknown token / missing action",
    async () => {
      const missingAction = await invoke("respond-to-reschedule", { token: "abc" });
      expect(missingAction.status).toBeGreaterThanOrEqual(400);

      const unknownToken = await invoke("respond-to-reschedule", {
        token: "00000000000000000000000000000000",
        action: "confirm",
      });
      expect(unknownToken.status).toBeGreaterThanOrEqual(400);
    },
    TIMEOUT,
  );

  it(
    "verify-otp rejects missing fields (no auth bypass on empty input)",
    async () => {
      const { status } = await invoke("verify-otp", { email: "a@b.com" });
      expect(status).toBeGreaterThanOrEqual(400);
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * H. AUTHENTICATION — invalid creds rejected, no ambient session
 * ================================================================== */
describe("AUDIT H — authentication boundary", () => {
  it(
    "a fresh anon client has no authenticated user",
    async () => {
      const { data } = await sb.auth.getSession();
      expect(data.session).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "invalid email/password login is rejected (no token issued)",
    async () => {
      const { data, error } = await sb.auth.signInWithPassword({
        email: "definitely-not-a-user@example.invalid",
        password: "wrong-password-12345",
      });
      expect(error).toBeTruthy();
      expect(data.session).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "anon (no JWT) cannot call an admin-only edge function successfully",
    async () => {
      // manage-roles is an admin/service function. With only the anon key it
      // must not perform a privileged mutation.
      const { status, json } = await invoke("manage-roles", {
        action: "grant",
        role: "super_admin",
        userId: RANDOM_UUID,
      });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(json?.success).toBeFalsy();
    },
    TIMEOUT,
  );
});

/* ====================================================================
 * G. STRIPE WEBHOOK — must reject unsigned calls
 * ================================================================== */
describe("AUDIT G — stripe-webhook signature enforcement", () => {
  it(
    "rejects a webhook call with no stripe-signature header",
    async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "evt_fake" } } }),
      });
      // Unsigned → must NOT be accepted as a real event.
      expect(res.status).toBeGreaterThanOrEqual(400);
    },
    TIMEOUT,
  );
});
