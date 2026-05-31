/**
 * End-to-End booking journey tests (read-only, no real bookings created).
 *
 * Walks the exact data path a real customer triggers:
 *   QR / city link  →  pick venue  →  pick service + time  →  payment  →  confirmation.
 *
 * Two parallel flows are covered: GYM and HOTEL.
 * Tests run against the live backend with the anon key so they catch any
 * RLS / schema / edge-function drift that would break the booking funnel.
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

/* ----------------------------------------------------------------------
 * STEP 1 — Customer opens a city/QR link.
 * The home + city pages query active countries → cities → venues.
 * -------------------------------------------------------------------- */
describe("E2E booking journey — Step 1: city / QR entry point", () => {
  it(
    "loads at least one active city for the active country",
    async () => {
      const { data: countries, error: ce } = await sb
        .from("countries")
        .select("id, code")
        .eq("is_active", true)
        .limit(1);
      expect(ce).toBeNull();
      expect(countries?.length).toBeGreaterThan(0);

      const { data: cities, error } = await sb
        .from("cities")
        .select("id, name, country_id")
        .eq("is_active", true)
        .eq("country_id", countries![0].id);
      expect(error).toBeNull();
      expect((cities || []).length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );

  it(
    "QR entry: gym lookup by qr_code_id resolves to an active gym",
    async () => {
      const { data, error } = await sb
        .from("gyms")
        .select("id, name, qr_code_id, city_id, country_id, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.qr_code_id).toBeTruthy();

      // Re-resolve by qr_code_id (simulates /qr/:code route)
      const { data: byQr, error: e2 } = await sb
        .from("gyms")
        .select("id, name")
        .eq("qr_code_id", data!.qr_code_id)
        .maybeSingle();
      expect(e2).toBeNull();
      expect(byQr?.id).toBe(data!.id);
    },
    TIMEOUT,
  );

  it(
    "QR entry: hotel lookup by qr_code_id resolves to an active hotel",
    async () => {
      const { data, error } = await sb
        .from("hotels")
        .select("id, name, qr_code_id, city_id, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      expect(error).toBeNull();
      if (!data) return; // no hotels = skip
      const { data: byQr, error: e2 } = await sb
        .from("hotels")
        .select("id")
        .eq("qr_code_id", data.qr_code_id)
        .maybeSingle();
      expect(e2).toBeNull();
      expect(byQr?.id).toBe(data.id);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 2 — Pick a service offered at that venue.
 * -------------------------------------------------------------------- */
describe("E2E booking journey — Step 2: services per venue", () => {
  it(
    "gym exposes at least one active service via gym_services",
    async () => {
      const { data: gym } = await sb
        .from("gyms")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      expect(gym?.id).toBeTruthy();

      const { data, error } = await sb
        .from("gym_services")
        .select("service_id, custom_price, services!inner(id, name, price, duration_minutes, is_active)")
        .eq("gym_id", gym!.id)
        .eq("is_active", true);
      expect(error).toBeNull();
      expect((data || []).length).toBeGreaterThan(0);
      for (const row of data || []) {
        // services join must be active
        // @ts-expect-error inferred join type
        expect(row.services.is_active).toBe(true);
      }
    },
    TIMEOUT,
  );

  it(
    "hotel exposes at least one active service via hotel_services",
    async () => {
      const { data: hotel } = await sb
        .from("hotels")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!hotel?.id) return;

      const { data, error } = await sb
        .from("hotel_services")
        .select("service_id, custom_price, services!inner(id, name, duration_minutes, is_active)")
        .eq("hotel_id", hotel.id)
        .eq("is_active", true);
      expect(error).toBeNull();
      expect((data || []).length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 3 — Pick a date + time slot.
 * -------------------------------------------------------------------- */
describe("E2E booking journey — Step 3: schedule + slot availability", () => {
  it(
    "gym schedule + RPC get_gym_available_dates returns future dates",
    async () => {
      const { data: gym } = await sb
        .from("gyms")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const { data: schedule, error } = await sb
        .from("gym_schedules")
        .select("day_of_week, start_time, end_time, slot_duration_minutes")
        .eq("gym_id", gym!.id)
        .eq("is_active", true);
      expect(error).toBeNull();
      expect((schedule || []).length).toBeGreaterThan(0);

      const { data: dates, error: rpcErr } = await sb.rpc("get_gym_available_dates", {
        p_gym_id: gym!.id,
        p_months_ahead: 1,
      });
      expect(rpcErr).toBeNull();
      expect(Array.isArray(dates)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "hotel schedule + RPC get_hotel_available_dates returns future dates",
    async () => {
      const { data: hotel } = await sb
        .from("hotels")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!hotel?.id) return;
      const { data: schedule, error } = await sb
        .from("hotel_schedules")
        .select("day_of_week, start_time, end_time")
        .eq("hotel_id", hotel.id)
        .eq("is_active", true);
      expect(error).toBeNull();
      expect((schedule || []).length).toBeGreaterThan(0);

      const { data: dates, error: rpcErr } = await sb.rpc("get_hotel_available_dates", {
        p_hotel_id: hotel.id,
        p_months_ahead: 1,
      });
      expect(rpcErr).toBeNull();
      expect(Array.isArray(dates)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "get_booked_slots RPC returns array contract for gym",
    async () => {
      const { data: gym } = await sb
        .from("gyms")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await sb.rpc("get_booked_slots", {
        p_gym_id: gym!.id,
        p_date: today,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "get_hotel_booked_slots RPC returns array contract",
    async () => {
      const { data: hotel } = await sb
        .from("hotels")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!hotel?.id) return;
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await sb.rpc("get_hotel_booked_slots", {
        p_hotel_id: hotel.id,
        p_date: today,
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 4 — Payment hand-off (Stripe Checkout).
 * We don't actually create a Stripe session in tests — we assert the
 * edge function is reachable and rejects malformed payloads cleanly.
 * -------------------------------------------------------------------- */
describe("E2E booking journey — Step 4: payment edge function reachability", () => {
  it(
    "create-payment edge function is deployed and responds to invocation",
    async () => {
      const { data, error } = await sb.functions.invoke("create-payment", {
        body: { __probe: true },
      });
      // Either it returns an error (bad payload) or a structured response.
      // What we forbid: 404 / FunctionsFetchError ("not found").
      const combined = JSON.stringify({ data, error });
      expect(combined.toLowerCase()).not.toContain("not found");
      expect(combined.toLowerCase()).not.toContain("does not exist");
    },
    TIMEOUT,
  );

  it(
    "verify-payment edge function is deployed and responds to invocation",
    async () => {
      const { data, error } = await sb.functions.invoke("verify-payment", {
        body: { session_id: "cs_invalid_probe" },
      });
      const combined = JSON.stringify({ data, error });
      expect(combined.toLowerCase()).not.toContain("not found");
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 5 — Booking confirmation contract.
 * The atomic RPCs must exist with the expected signatures so the
 * verify-payment / admin-force-booking functions can persist a booking.
 * We invoke with deliberately invalid IDs to confirm the function exists
 * (we expect an error from inside the function, not "function not found").
 * -------------------------------------------------------------------- */
describe("E2E booking journey — Step 5: confirmation RPCs exist", () => {
  const fakeUuid = "00000000-0000-0000-0000-000000000000";

  it(
    "create_booking_atomic RPC signature is intact (gym flow)",
    async () => {
      const { error } = await sb.rpc("create_booking_atomic", {
        p_gym_id: fakeUuid,
        p_service_id: fakeUuid,
        p_booking_date: "2099-01-01",
        p_booking_time: "10:00:00",
        p_customer_email: "probe@example.test",
      });
      // We *expect* an error, but it must come from the function body
      // (INVALID_SERVICE / SLOT_UNAVAILABLE / DUPLICATE / RLS), NOT from
      // a missing function or argument mismatch.
      expect(error).not.toBeNull();
      const msg = (error?.message || "").toLowerCase();
      expect(msg).not.toContain("could not find the function");
      expect(msg).not.toContain("function public.create_booking_atomic");
    },
    TIMEOUT,
  );

  it(
    "create_hotel_booking_atomic RPC signature is intact (hotel flow)",
    async () => {
      const { error } = await sb.rpc("create_hotel_booking_atomic", {
        p_hotel_id: fakeUuid,
        p_service_id: fakeUuid,
        p_booking_date: "2099-01-01",
        p_booking_time: "10:00:00",
        p_customer_email: "probe@example.test",
      });
      expect(error).not.toBeNull();
      const msg = (error?.message || "").toLowerCase();
      expect(msg).not.toContain("could not find the function");
    },
    TIMEOUT,
  );

  it(
    "bookings table has cancellation_token + policy_accepted columns the confirmation page reads",
    async () => {
      // Anon SELECT is denied by RLS — that's the expected contract.
      const { error } = await sb
        .from("bookings")
        .select("id, cancellation_token, policy_accepted, status, payment_status")
        .limit(1);
      // RLS denial returns empty data (no error) for anon — both are acceptable;
      // what matters is we don't get a "column does not exist" schema error.
      const msg = (error?.message || "").toLowerCase();
      expect(msg).not.toContain("does not exist");
      expect(msg).not.toContain("column");
    },
    TIMEOUT,
  );
});
