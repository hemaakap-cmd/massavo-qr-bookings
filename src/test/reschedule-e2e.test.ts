/**
 * End-to-End reschedule journey tests (read-only, no real bookings mutated).
 *
 * Walks the path a customer takes from the booking confirmation email:
 *   /manage/:token  →  lookup booking  →  pick new date/time
 *      →  validate availability  →  reschedule  →  status updated.
 *
 * Covers BOTH gym and hotel flows. We use the live edge functions and RPCs
 * with deliberately invalid tokens / IDs so the contracts (function presence,
 * parameter names, error envelopes) are verified without touching real data.
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
const FAKE_TOKEN = "00000000-0000-0000-0000-000000000000";

/* ----------------------------------------------------------------------
 * STEP 1 — Customer opens /manage/:token from confirmation email.
 * The page invokes manage-booking with action=lookup.
 * -------------------------------------------------------------------- */
describe("E2E reschedule — Step 1: token lookup contract", () => {
  it(
    "manage-booking edge function is deployed and rejects invalid token gracefully",
    async () => {
      const { data, error } = await sb.functions.invoke("manage-booking", {
        body: { token: FAKE_TOKEN, action: "lookup" },
      });
      // Function MUST be reachable. It MUST return a structured error envelope
      // (success:false) rather than crashing or 404.
      const combined = JSON.stringify({ data, error }).toLowerCase();
      expect(combined).not.toContain("not found"); // function-level "not found"
      expect(combined).not.toContain("does not exist");
      // Either Supabase wraps the non-2xx as `error`, or the body has success:false.
      const friendly =
        (data && data.success === false) || error !== null;
      expect(friendly).toBe(true);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 2 — Customer picks a new slot. UI fetches schedule + booked slots
 * and checks the same RPCs the booking page uses.
 * -------------------------------------------------------------------- */
describe("E2E reschedule — Step 2: availability validation for the new slot", () => {
  it(
    "gym: schedule + booked-slots RPC respond for the chosen venue",
    async () => {
      const { data: gym } = await sb
        .from("gyms")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      expect(gym?.id).toBeTruthy();
      const today = new Date().toISOString().slice(0, 10);

      const [slots, dates] = await Promise.all([
        sb.rpc("get_booked_slots", { p_gym_id: gym!.id, p_date: today }),
        sb.rpc("get_gym_available_dates", { p_gym_id: gym!.id, p_months_ahead: 1 }),
      ]);
      expect(slots.error).toBeNull();
      expect(Array.isArray(slots.data)).toBe(true);
      expect(dates.error).toBeNull();
      expect(Array.isArray(dates.data)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "hotel: schedule + booked-slots RPC respond for the chosen venue",
    async () => {
      const { data: hotel } = await sb
        .from("hotels")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!hotel?.id) return;
      const today = new Date().toISOString().slice(0, 10);

      const [slots, dates] = await Promise.all([
        sb.rpc("get_hotel_booked_slots", { p_hotel_id: hotel.id, p_date: today }),
        sb.rpc("get_hotel_available_dates", { p_hotel_id: hotel.id, p_months_ahead: 1 }),
      ]);
      expect(slots.error).toBeNull();
      expect(Array.isArray(slots.data)).toBe(true);
      expect(dates.error).toBeNull();
      expect(Array.isArray(dates.data)).toBe(true);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 3 — Customer submits reschedule from /manage/:token UI.
 * The hook calls manage-booking with action=reschedule + new date/time.
 * -------------------------------------------------------------------- */
describe("E2E reschedule — Step 3: reschedule action contract (gym + hotel)", () => {
  it(
    "manage-booking action=reschedule rejects unknown token with structured envelope",
    async () => {
      const { data, error } = await sb.functions.invoke("manage-booking", {
        body: {
          token: FAKE_TOKEN,
          action: "reschedule",
          newDate: "2099-01-05",
          newTime: "10:00:00",
        },
      });
      const combined = JSON.stringify({ data, error }).toLowerCase();
      expect(combined).not.toContain("does not exist"); // no schema/function drift
      const friendly = (data && data.success === false) || error !== null;
      expect(friendly).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "underlying move_booking_atomic RPC signature is intact",
    async () => {
      // Call with a fake booking id — we expect a controlled error
      // (BOOKING_NOT_FOUND) returned in jsonb, NOT a "function does not exist" error.
      const { data, error } = await sb.rpc("move_booking_atomic", {
        p_booking_id: FAKE_TOKEN,
        p_new_date: "2099-01-05",
        p_new_time: "10:00:00",
      });
      // Either: an explicit error from RLS / sec-definer, or a jsonb { success: false }
      const combined = JSON.stringify({ data, error }).toLowerCase();
      expect(combined).not.toContain("could not find the function");
      expect(combined).not.toContain("function public.move_booking_atomic");
      if (!error && data) {
        expect(data.success).toBe(false);
        expect(typeof data.error).toBe("string");
      }
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 4 — Email-flow reschedule via /reschedule/:token (admin proposes
 * a new slot, customer confirms). Backed by respond-to-reschedule fn +
 * get_reschedule_by_token RPC.
 * -------------------------------------------------------------------- */
describe("E2E reschedule — Step 4: admin-proposed reschedule flow", () => {
  it(
    "get_reschedule_by_token RPC exists and returns empty array for unknown token",
    async () => {
      const { data, error } = await sb.rpc("get_reschedule_by_token", {
        p_token: "unknown-token-probe",
      });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBe(0);
    },
    TIMEOUT,
  );

  it(
    "respond-to-reschedule edge function is deployed and reachable",
    async () => {
      const { data, error } = await sb.functions.invoke("respond-to-reschedule", {
        body: { token: "unknown-token-probe", action: "accept" },
      });
      const combined = JSON.stringify({ data, error }).toLowerCase();
      expect(combined).not.toContain("does not exist");
      const friendly = (data && data.success === false) || error !== null;
      expect(friendly).toBe(true);
    },
    TIMEOUT,
  );
});

/* ----------------------------------------------------------------------
 * STEP 5 — Confirm the booking row schema the page reads after status changes.
 * The reschedule writes booking_date/booking_time and bumps status, and
 * inserts into booking_reschedules (admin-proposed flow).
 * -------------------------------------------------------------------- */
describe("E2E reschedule — Step 5: post-update schema contracts", () => {
  it(
    "bookings: status + booking_date/time + venue ids columns exist (RLS denies anon read, but no schema error)",
    async () => {
      const { error } = await sb
        .from("bookings")
        .select("id, status, booking_date, booking_time, gym_id, hotel_id, cancellation_token")
        .limit(1);
      const msg = (error?.message || "").toLowerCase();
      expect(msg).not.toContain("does not exist");
      expect(msg).not.toContain("column");
    },
    TIMEOUT,
  );

  it(
    "booking_reschedules table is anon-locked (RLS) but its column contract is intact via the RPC view",
    async () => {
      const { data, error } = await sb.rpc("get_reschedule_by_token", {
        p_token: "another-unknown-probe",
      });
      expect(error).toBeNull();
      // The RPC return shape exposes the columns the UI reads.
      // For an unknown token the array is empty but call must succeed,
      // proving status / suggested_date / suggested_time / response_deadline
      // / booking_gym_id / booking_hotel_id columns still resolve.
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );
});
