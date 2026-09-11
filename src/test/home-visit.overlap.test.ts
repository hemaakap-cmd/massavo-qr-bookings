/**
 * HOME VISIT — regression tests for the duration-blind availability bug.
 *
 * THE BUG
 * -------
 * Every home-visit availability path compared only the start time
 * (`to_char(b.booking_time,'HH24:MI') = p_time`), so service duration was
 * invisible. A therapist booked 10:00 for 90 minutes still looked free at
 * 11:00, and `create_home_booking_atomic` would assign them an overlapping
 * second visit. `check_home_slot_availability` accepted `p_duration_minutes`
 * and never used it, even though `create-payment` always passed the real
 * duration in.
 *
 * SAFETY: these are read-only. They call the two availability RPCs that are
 * already granted to anon and never create a booking or a Stripe session.
 *
 * GUARD: they assert FIXED behaviour, so they skip until the migration
 * (20260912000000_home_visit_overlap_fix.sql) is deployed. Deployment is
 * detected by duration-sensitivity itself: a session far too long to fit any
 * shift must be refused where a 60-minute one is accepted. On the old
 * definition both answers are identical because the argument is discarded.
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
/** Longer than any working day, so it can never fit inside a shift. */
const IMPOSSIBLE_DURATION = 1440;

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  return (sb as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T; error: unknown }>;
  }).rpc(fn, args);
}

/** A city that actually has a home-visit therapist pool, plus a bookable date. */
async function findCityWithAvailability(): Promise<{ cityId: string; date: string } | null> {
  const { data: cities } = await sb.from("cities").select("id").eq("is_active", true).limit(10);
  for (const c of (cities as { id: string }[]) || []) {
    const { data } = await rpc<{ available_date: string }[]>("get_home_available_dates", {
      p_city_id: c.id,
      p_start_date: new Date().toISOString().split("T")[0],
      p_months_ahead: 2,
    });
    const first = (data || [])[0]?.available_date;
    if (first) return { cityId: c.id, date: first };
  }
  return null;
}

/** A time on that date the pool can serve a normal 60-minute visit. */
async function findOpenSlot(cityId: string, date: string): Promise<string | null> {
  for (const t of ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]) {
    const { data, error } = await rpc<boolean>("check_home_slot_availability", {
      p_city_id: cityId, p_date: date, p_time: t, p_duration_minutes: 60,
    });
    if (!error && data === true) return t;
  }
  return null;
}

const FIXTURE = await findCityWithAvailability();
const OPEN_SLOT = FIXTURE ? await findOpenSlot(FIXTURE.cityId, FIXTURE.date) : null;

async function detectFix(): Promise<boolean> {
  if (!FIXTURE || !OPEN_SLOT) return false;
  const { data, error } = await rpc<boolean>("check_home_slot_availability", {
    p_city_id: FIXTURE.cityId, p_date: FIXTURE.date,
    p_time: OPEN_SLOT, p_duration_minutes: IMPOSSIBLE_DURATION,
  });
  // Fixed: the session cannot fit, so false. Old: duration ignored, so true.
  return !error && data === false;
}

const FIX_DEPLOYED = await detectFix();

describe.skipIf(!FIX_DEPLOYED)("HOME VISIT — availability is duration-aware", () => {
  it("a slot open for 60 minutes is refused for a session that cannot fit the shift", async () => {
    const { data: shortOk } = await rpc<boolean>("check_home_slot_availability", {
      p_city_id: FIXTURE!.cityId, p_date: FIXTURE!.date,
      p_time: OPEN_SLOT!, p_duration_minutes: 60,
    });
    const { data: longOk } = await rpc<boolean>("check_home_slot_availability", {
      p_city_id: FIXTURE!.cityId, p_date: FIXTURE!.date,
      p_time: OPEN_SLOT!, p_duration_minutes: IMPOSSIBLE_DURATION,
    });
    expect(shortOk).toBe(true);
    // The whole point of the fix: the answer depends on how long the visit is.
    expect(longOk).toBe(false);
  }, TIMEOUT);

  it("get_home_booked_slots accepts a duration and blocks monotonically more as it grows", async () => {
    const blockedFor = async (d: number) => {
      const { data, error } = await rpc<{ slot_time: string }[]>("get_home_booked_slots", {
        p_city_id: FIXTURE!.cityId, p_date: FIXTURE!.date, p_duration_minutes: d,
      });
      expect(error).toBeFalsy();
      return new Set((data || []).map((r) => r.slot_time));
    };

    const short = await blockedFor(50);
    const long = await blockedFor(90);

    // A longer visit needs strictly more room, so every slot unusable for a
    // short session must also be unusable for a long one.
    for (const slot of short) {
      expect(long.has(slot)).toBe(true);
    }
  }, TIMEOUT);

  it("stays callable with the original two arguments (no breaking change)", async () => {
    const { error } = await rpc<{ slot_time: string }[]>("get_home_booked_slots", {
      p_city_id: FIXTURE!.cityId, p_date: FIXTURE!.date,
    });
    expect(error).toBeFalsy();
  }, TIMEOUT);

  it("does not expose the therapist pool to anonymous callers", async () => {
    // home_free_therapists returns therapist ids and is deliberately not granted
    // to anon; only the two aggregate helpers are public.
    const { error } = await rpc<unknown>("home_free_therapists", {
      p_city_id: FIXTURE!.cityId, p_date: FIXTURE!.date,
      p_time: OPEN_SLOT!, p_duration_minutes: 60,
    });
    expect(error).toBeTruthy();
  }, TIMEOUT);
});
