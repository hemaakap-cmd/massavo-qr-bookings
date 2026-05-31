/**
 * Staff portal ↔ Backend integration tests.
 *
 * Verifies that the schemas, RPCs, and access functions used by
 * src/pages/staff/* and src/components/staff/* still exist with the
 * shape the frontend expects. Anonymous queries below MUST NOT leak
 * any rows — they verify RLS deny on therapist-only data.
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

/** Tables read by the Staff portal — anon must always get 0 rows. */
describe("Staff RLS — anonymous users see nothing", () => {
  const staffTables = [
    "therapists",
    "therapist_weekly_schedules",
    "therapist_venues",
    "therapist_gyms",
    "therapist_hotels",
    "therapist_leaves",
    "therapist_assignments",
    "booking_body_areas",
    "body_area_change_logs",
    "clinical_access_logs",
  ];

  for (const table of staffTables) {
    it(
      `${table}: anon select returns no rows`,
      async () => {
        const { data } = await (sb as any).from(table).select("*").limit(1);
        expect((data || []).length).toBe(0);
      },
      TIMEOUT,
    );
  }
});

/**
 * The exact column shapes the staff hooks rely on.
 * Anonymous callers may get either no rows (RLS) or "permission denied"
 * (REVOKE on the table). Either is fine — both prove the column list
 * is valid (Postgres validates columns before applying grants/RLS).
 * What we DON'T want is "column does not exist".
 */
const acceptableSchemaError = (msg: string | undefined) => {
  if (!msg) return true;
  const lc = msg.toLowerCase();
  if (lc.includes("permission denied")) return true;
  if (lc.includes("row-level security")) return true;
  return false;
};

describe("Staff schema contract — required columns must exist", () => {
  it(
    "therapist_weekly_schedules: probe accepts the column list used by StaffWorkingDays",
    async () => {
      const { error } = await sb
        .from("therapist_weekly_schedules")
        .select(
          "id, day_of_week, start_time, end_time, is_primary, gym_id, hotel_id, is_active, therapist_id",
        )
        .limit(1);
      expect(acceptableSchemaError(error?.message), error?.message).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "therapist_venues: required columns for unified link panel",
    async () => {
      const { error } = await (sb as any)
        .from("therapist_venues")
        .select("id, therapist_id, venue_type, venue_id, is_primary, is_active")
        .limit(1);
      expect(acceptableSchemaError(error?.message), error?.message).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "bookings: column list used by useStaffBookings is valid",
    async () => {
      const { error } = await (sb as any)
        .from("bookings")
        .select(
          "id, booking_date, booking_time, customer_name, customer_email, status, payment_status, notes, communication_preference, gender, pregnancy_status, gym_id, hotel_id, therapist_id",
        )
        .limit(1);
      expect(acceptableSchemaError(error?.message), error?.message).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "therapist_leaves: required columns for leave-aware schedule",
    async () => {
      const { error } = await (sb as any)
        .from("therapist_leaves")
        .select("id, therapist_id, start_date, end_date, status, leave_type")
        .limit(1);
      expect(acceptableSchemaError(error?.message), error?.message).toBe(true);
    },
    TIMEOUT,
  );
});

/** Sanity — booked slots & available dates RPCs still callable for hotels too. */
describe("Staff-facing RPCs", () => {
  it(
    "get_booked_slots(p_gym_id, p_date) returns array shape",
    async () => {
      // Use a random uuid — RPC should return [] rather than 500.
      const { data, error } = await (sb as any).rpc("get_booked_slots", {
        p_gym_id: "00000000-0000-0000-0000-000000000000",
        p_date: new Date().toISOString().split("T")[0],
      });
      expect(error, error?.message).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "get_hotel_booked_slots(p_hotel_id, p_date) is reachable",
    async () => {
      const { data, error } = await (sb as any).rpc("get_hotel_booked_slots", {
        p_hotel_id: "00000000-0000-0000-0000-000000000000",
        p_date: new Date().toISOString().split("T")[0],
      });
      expect(error, error?.message).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "therapist_has_gym_access denies anon callers (auth.uid() is null)",
    async () => {
      // Should not throw and should return false for an unknown user.
      const { data, error } = await (sb as any).rpc("therapist_has_gym_access", {
        _user_id: "00000000-0000-0000-0000-000000000000",
        _gym_id: "00000000-0000-0000-0000-000000000000",
        _booking_date: new Date().toISOString().split("T")[0],
      });
      expect(error, error?.message).toBeNull();
      expect(data).toBe(false);
    },
    TIMEOUT,
  );
});
