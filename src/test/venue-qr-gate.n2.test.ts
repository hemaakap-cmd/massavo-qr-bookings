/**
 * N-2 regression suite — server-side QR/venue authorization.
 *
 * The general public website must not expose gym/hotel catalogues, prices or
 * availability. Access is granted only by a signed, venue-scoped token issued
 * by the `venue-access` edge function; sessionStorage is never the boundary.
 *
 * Read-only: only denial paths and read actions are exercised. No bookings,
 * no payments, no writes.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

const TIMEOUT = 30_000;
const FAKE_VENUE = "00000000-0000-4000-8000-000000000002";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function venueAccess(body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/venue-access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  let parsed: Record<string, any> = {};
  try {
    parsed = await res.json();
  } catch {
    parsed = {};
  }
  return { status: res.status, body: parsed };
}

let gymA: string | undefined;
let gymB: string | undefined;
let hotelA: string | undefined;
let hotelB: string | undefined;
let tokenGymA: string | undefined;
let tokenHotelA: string | undefined;

beforeAll(async () => {
  const { data: gyms } = await sb.from("gyms").select("id").eq("is_active", true).limit(2);
  gymA = gyms?.[0]?.id;
  gymB = gyms?.[1]?.id;
  const { data: hotels } = await sb.from("hotels").select("id").eq("is_active", true).limit(2);
  hotelA = hotels?.[0]?.id;
  hotelB = hotels?.[1]?.id;

  if (gymA) tokenGymA = (await venueAccess({ action: "claim", venueType: "gym", venueId: gymA })).body.token;
  if (hotelA)
    tokenHotelA = (await venueAccess({ action: "claim", venueType: "hotel", venueId: hotelA })).body.token;
}, TIMEOUT);

describe("N-2 — protected venue data requires a valid QR token", () => {
  it(
    "1. no token → gym catalogue denied",
    async () => {
      const { status, body } = await venueAccess({ action: "catalogue", venueType: "gym", venueId: gymA });
      expect(status).toBe(403);
      expect(body.services).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "2. no token → hotel catalogue and availability denied",
    async () => {
      if (!hotelA) return;
      const cat = await venueAccess({ action: "catalogue", venueType: "hotel", venueId: hotelA });
      const avail = await venueAccess({ action: "availability", venueType: "hotel", venueId: hotelA });
      expect(cat.status).toBe(403);
      expect(avail.status).toBe(403);
    },
    TIMEOUT,
  );

  it(
    "3. valid Gym A token → Gym A data allowed",
    async () => {
      const { status, body } = await venueAccess({
        action: "catalogue",
        venueType: "gym",
        venueId: gymA,
        token: tokenGymA,
      });
      expect(status).toBe(200);
      expect(Array.isArray(body.services)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "4. Gym A token → Gym B denied",
    async () => {
      if (!gymB) return;
      const { status, body } = await venueAccess({
        action: "catalogue",
        venueType: "gym",
        venueId: gymB,
        token: tokenGymA,
      });
      expect(status).toBe(403);
      expect(body.reason).toBe("venue_mismatch");
    },
    TIMEOUT,
  );

  it(
    "5. Gym A token → hotel data denied",
    async () => {
      if (!hotelA) return;
      const { status } = await venueAccess({
        action: "catalogue",
        venueType: "hotel",
        venueId: hotelA,
        token: tokenGymA,
      });
      expect(status).toBe(403);
    },
    TIMEOUT,
  );

  it(
    "6. valid Hotel A token → Hotel A allowed",
    async () => {
      if (!hotelA) return;
      const { status, body } = await venueAccess({
        action: "catalogue",
        venueType: "hotel",
        venueId: hotelA,
        token: tokenHotelA,
      });
      expect(status).toBe(200);
      expect(Array.isArray(body.services)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "7. Hotel A token → Hotel B denied",
    async () => {
      if (!hotelB) return;
      const { status } = await venueAccess({
        action: "catalogue",
        venueType: "hotel",
        venueId: hotelB,
        token: tokenHotelA,
      });
      expect(status).toBe(403);
    },
    TIMEOUT,
  );

  it(
    "8. Hotel A token → gym data denied",
    async () => {
      if (!hotelA || !gymA) return;
      const { status } = await venueAccess({
        action: "catalogue",
        venueType: "gym",
        venueId: gymA,
        token: tokenHotelA,
      });
      expect(status).toBe(403);
    },
    TIMEOUT,
  );

  it(
    "9. forged / tampered tokens are rejected",
    async () => {
      const tampered = `${tokenGymA!.slice(0, -2)}AA`;
      const swapped = `${btoa(JSON.stringify({ t: "gym", v: gymB ?? FAKE_VENUE, iat: 1, exp: 9999999999, jti: "x" }))}.signature`;
      for (const token of [tampered, swapped, "not-a-token", ""]) {
        const { status } = await venueAccess({
          action: "catalogue",
          venueType: "gym",
          venueId: gymA,
          token,
        });
        expect(status).toBe(403);
      }
    },
    TIMEOUT,
  );

  it(
    "10. unknown / inactive venue cannot be claimed (revocation path)",
    async () => {
      const { status, body } = await venueAccess({
        action: "claim",
        venueType: "gym",
        venueId: FAKE_VENUE,
      });
      expect(status).toBe(404);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "anon clients cannot read venue mappings, schedules or availability directly",
    async () => {
      const probes = await Promise.all([
        sb.from("gym_services").select("service_id").limit(1),
        sb.from("hotel_services").select("service_id").limit(1),
        sb.from("gym_schedules").select("id").limit(1),
        sb.from("hotel_schedules").select("id").limit(1),
      ]);
      for (const p of probes) expect(p.error).not.toBeNull();
    },
    TIMEOUT,
  );

  it(
    "home visit stays public — it must NOT be gated by the gym/hotel QR token",
    async () => {
      const { data: city } = await sb.from("cities").select("id").eq("is_active", true).limit(1).maybeSingle();
      if (!city?.id) return;
      const { error } = await sb.rpc("get_home_available_dates", {
        p_city_id: city.id,
        p_start_date: new Date().toISOString().slice(0, 10),
        p_months_ahead: 1,
      });
      expect(error).toBeNull();
    },
    TIMEOUT,
  );
});
