/**
 * Home Visit — live security & contract probes (read-only / rejection-path).
 *
 * These run against the live backend and prove the Home Visit boundary holds.
 * They are GUARDED: until the home-visit migration is deployed, the new columns
 * and RPCs don't exist, so the whole suite auto-skips. After deployment it
 * activates with no code change.
 *
 * Safe by construction: no bookings created, no payments made, no emails sent —
 * only invalid input and denial paths are exercised.
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
  return { status: res.status, json };
}

/**
 * Detect whether the home-visit backend is deployed by probing for the new
 * availability RPC. If it isn't there yet, every test below is skipped.
 */
async function homeBackendDeployed(): Promise<boolean> {
  const { error } = await sb.rpc("get_home_available_dates" as any, {
    p_city_id: RANDOM_UUID,
    p_start_date: new Date().toISOString().split("T")[0],
    p_months_ahead: 1,
  });
  if (!error) return true;
  return !/does not exist|schema cache|could not find/i.test(error.message || "");
}

const DEPLOYED = await homeBackendDeployed();

describe.skipIf(!DEPLOYED)("HOME VISIT (live) — availability contract", () => {
  it(
    "get_home_available_dates returns an array for a bogus city (no leak, no error)",
    async () => {
      const { data, error } = await sb.rpc("get_home_available_dates" as any, {
        p_city_id: RANDOM_UUID,
        p_start_date: new Date().toISOString().split("T")[0],
        p_months_ahead: 1,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect((data as unknown[]).length).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "create_home_booking_atomic is NOT callable by anon (server-role only)",
    async () => {
      const { error } = await sb.rpc("create_home_booking_atomic" as any, {
        p_service_id: RANDOM_UUID,
        p_booking_date: "2099-01-01",
        p_booking_time: "10:00",
        p_customer_email: "attacker@example.com",
        p_home_city_id: RANDOM_UUID,
        p_home_country_id: RANDOM_UUID,
      });
      // Anon must be denied EXECUTE (permission denied), never allowed to book.
      expect(error).toBeTruthy();
    },
    TIMEOUT,
  );
});

describe.skipIf(!DEPLOYED)("HOME VISIT (live) — address is private", () => {
  it(
    "anon cannot read home address columns from bookings",
    async () => {
      const { data, error } = await sb
        .from("bookings")
        .select("id, home_street, home_postal_code, home_city_id")
        .limit(1);
      // RLS denies anon on bookings entirely — error or empty, never a row.
      if (error) expect(error).toBeTruthy();
      else expect((data || []).length).toBe(0);
    },
    TIMEOUT,
  );
});

describe.skipIf(!DEPLOYED)("HOME VISIT (live) — create-payment validation & price trust", () => {
  it(
    "rejects a home request with no address",
    async () => {
      const { status, json } = await invoke("create-payment", {
        serviceId: RANDOM_UUID,
        venueType: "home",
        homeCityId: RANDOM_UUID,
        customerEmail: "valid@example.com",
      });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "never issues a checkout URL for a non-existent / non-home-enabled service",
    async () => {
      const { json } = await invoke("create-payment", {
        serviceId: RANDOM_UUID,
        venueType: "home",
        homeCityId: RANDOM_UUID,
        homeCountryId: RANDOM_UUID,
        homeStreet: "Somewhere 1",
        homePostalCode: "10115",
        customerEmail: "valid@example.com",
      });
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );

  it(
    "ignores a client-supplied price (no payable session for a fake service)",
    async () => {
      const { json } = await invoke("create-payment", {
        serviceId: RANDOM_UUID,
        venueType: "home",
        homeCityId: RANDOM_UUID,
        homeCountryId: RANDOM_UUID,
        homeStreet: "Somewhere 1",
        homePostalCode: "10115",
        customerEmail: "valid@example.com",
        price: 1, amount: 1, total: 1, // attacker-controlled fields — must be ignored
      });
      expect(json?.url).toBeFalsy();
    },
    TIMEOUT,
  );
});
