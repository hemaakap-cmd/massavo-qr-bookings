/**
 * Frontend ↔ Backend integration tests.
 *
 * These tests run against the live Lovable Cloud (Supabase) project using the
 * public anon key. They verify that the schemas, RLS policies, and edge
 * function contracts the frontend code depends on are still in sync with the
 * backend. They are read-only and safe to run in CI.
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

const TIMEOUT = 20_000;

describe("public catalog (anon) — schema contract", () => {
  it(
    "countries: returns active rows with the fields the country switcher uses",
    async () => {
      const { data, error } = await sb
        .from("countries")
        .select("id, code, name, name_ar, currency_code, currency_symbol, default_language, is_active")
        .eq("is_active", true);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect((data || []).length).toBeGreaterThan(0);
      for (const c of data || []) {
        expect(c.id).toBeTruthy();
        expect(typeof c.code).toBe("string");
        expect(typeof c.name).toBe("string");
        expect(typeof c.currency_code).toBe("string");
      }
    },
    TIMEOUT,
  );

  it(
    "cities: anon can read active cities (used by /cities + city pages)",
    async () => {
      const { data, error } = await sb
        .from("cities")
        .select("id, name, country_id, federal_state_id, is_active")
        .eq("is_active", true)
        .limit(5);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "gyms: anon sees only active gyms (RLS public.is_active=true)",
    async () => {
      const { data, error } = await sb
        .from("gyms")
        .select("id, name, address, city_id, country_id, image_url, is_active")
        .limit(20);
      expect(error).toBeNull();
      for (const g of data || []) {
        expect(g.is_active).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    "hotels: anon sees only active hotels (used by city page Hotels section)",
    async () => {
      const { data, error } = await sb
        .from("hotels")
        .select("id, name, address, city_id, country_id, is_active")
        .limit(20);
      expect(error).toBeNull();
      for (const h of data || []) {
        expect(h.is_active).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    "services: hidden test service (price < 5) is NOT publicly visible",
    async () => {
      const { data, error } = await sb
        .from("services")
        .select("id, name, price, is_active")
        .eq("is_active", true);
      expect(error).toBeNull();
      const cheap = (data || []).filter((s: any) => Number(s.price) < 5);
      expect(cheap, `cheap test services leaked: ${JSON.stringify(cheap)}`).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "gym_schedules: anon can read active schedules (calendar picker)",
    async () => {
      const { data, error } = await sb
        .from("gym_schedules")
        .select("id, gym_id, day_of_week, start_time, end_time, is_active")
        .eq("is_active", true)
        .limit(5);
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );
});

describe("RLS protection — anon must NOT read sensitive tables", () => {
  it(
    "bookings: anon cannot select",
    async () => {
      const { data, error } = await sb.from("bookings").select("id").limit(1);
      // Either an error (deny policy) or empty data — never real rows.
      expect((data || []).length).toBe(0);
      // an explicit error is also acceptable
      if (error) expect(error.message).toBeTruthy();
    },
    TIMEOUT,
  );

  it(
    "profiles: anon cannot select",
    async () => {
      const { data } = await sb.from("profiles").select("id").limit(1);
      expect((data || []).length).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "country_financials: anon cannot select",
    async () => {
      const { data } = await sb.from("country_financials").select("country_id").limit(1);
      expect((data || []).length).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "gym_contacts: anon cannot select",
    async () => {
      const { data } = await sb.from("gym_contacts").select("id").limit(1);
      expect((data || []).length).toBe(0);
    },
    TIMEOUT,
  );
});

describe("RPCs the booking flow depends on", () => {
  it(
    "get_gym_available_dates exists and returns rows with expected shape",
    async () => {
      const { data: gyms } = await sb.from("gyms").select("id").limit(1);
      const gymId = gyms?.[0]?.id;
      if (!gymId) return; // no gyms in tenant — skip silently
      const { data, error } = await sb.rpc("get_gym_available_dates", {
        p_gym_id: gymId,
        p_start_date: new Date().toISOString().split("T")[0],
        p_months_ahead: 1,
      });
      expect(error).toBeNull();
      for (const row of (data || []).slice(0, 3)) {
        expect(row).toHaveProperty("available_date");
        expect(row).toHaveProperty("start_time");
        expect(row).toHaveProperty("end_time");
      }
    },
    TIMEOUT,
  );
});

describe("Edge functions — public contracts", () => {
  it(
    "get-home-performance returns aggregated stats for the home page",
    async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-home-performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      expect(res.status, `body=${text}`).toBeLessThan(500);
      // Response should be JSON
      const json = JSON.parse(text);
      expect(json).toBeTypeOf("object");
    },
    TIMEOUT,
  );

  it(
    "get-gyms-public returns a JSON array (or {gyms:[]})",
    async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-gyms-public`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      expect(res.status, `body=${text}`).toBeLessThan(500);
      const json = JSON.parse(text);
      const arr = Array.isArray(json) ? json : json.gyms || json.data || [];
      expect(Array.isArray(arr)).toBe(true);
    },
    TIMEOUT,
  );
});
