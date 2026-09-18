/**
 * N-2 + H-1 regression suite — server-side QR/venue authorization.
 *
 * H-1 rule: a venue token can ONLY be obtained by presenting the venue's
 * physical QR secret (qr_code_id). Knowing or enumerating a venue id is never
 * sufficient. N-2 rule: catalogue/availability require a token scoped to that
 * exact venue.
 *
 * The positive ("valid QR") cases need a real QR secret, which is deliberately
 * not readable by anonymous clients and never committed. Supply it through the
 * TEST_GYM_QR_CODE / TEST_HOTEL_QR_CODE environment variables; without them the
 * positive cases are skipped (reported as BLOCKED) while all denial paths still
 * run.
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
const GYM_QR = process.env.TEST_GYM_QR_CODE || "";
const HOTEL_QR = process.env.TEST_HOTEL_QR_CODE || "";

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
let tokenGymAVenue: string | undefined;
let tokenHotelA: string | undefined;
let tokenHotelAVenue: string | undefined;

beforeAll(async () => {
  // Public venue ids come from the column-limited public views (no qr_code_id).
  const { data: gyms } = await sb.from("gyms_public").select("id").limit(2);
  gymA = gyms?.[0]?.id;
  gymB = gyms?.[1]?.id;
  const { data: hotels } = await sb.from("hotels_public").select("id").limit(2);
  hotelA = hotels?.[0]?.id;
  hotelB = hotels?.[1]?.id;

  if (GYM_QR) {
    const res = await venueAccess({ action: "claim", venueType: "gym", code: GYM_QR });
    tokenGymA = res.body.token;
    tokenGymAVenue = res.body.venue?.id;
  }
  if (HOTEL_QR) {
    const res = await venueAccess({ action: "claim", venueType: "hotel", code: HOTEL_QR });
    tokenHotelA = res.body.token;
    tokenHotelAVenue = res.body.venue?.id;
  }
}, TIMEOUT);

describe("H-1 — a venue token requires the physical QR secret", () => {
  it(
    "H-1.1 claim with a bare venue id (no QR secret) is rejected",
    async () => {
      const { status, body } = await venueAccess({ action: "claim", venueType: "gym", venueId: gymA });
      expect(status).toBe(401);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "H-1.2 claim with a bare hotel id (no QR secret) is rejected",
    async () => {
      const { status, body } = await venueAccess({ action: "claim", venueType: "hotel", venueId: hotelA });
      expect(status).toBe(401);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "H-1.3 empty, short or invalid QR codes are rejected",
    async () => {
      for (const code of ["", "   ", "abc"]) {
        const { status, body } = await venueAccess({ action: "claim", venueType: "gym", code });
        expect(status).toBe(401);
        expect(body.token).toBeUndefined();
      }
      const unknown = await venueAccess({
        action: "claim",
        venueType: "gym",
        code: "definitely-not-a-real-qr-code-xyz-123",
      });
      expect(unknown.status).toBe(404);
      expect(unknown.body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "H-1.4 a random / unknown venue id yields no token",
    async () => {
      const { status, body } = await venueAccess({
        action: "claim",
        venueType: "gym",
        venueId: FAKE_VENUE,
      });
      expect(status).toBe(401);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "H-1.5 anonymous clients cannot read qr_code_id, commission_percentage or phone",
    async () => {
      const probes = await Promise.all([
        sb.from("gyms").select("qr_code_id").limit(1),
        sb.from("gyms").select("commission_percentage").limit(1),
        sb.from("gyms").select("phone").limit(1),
        sb.from("hotels").select("qr_code_id").limit(1),
        sb.from("hotels").select("commission_percentage").limit(1),
        sb.from("hotels").select("phone").limit(1),
      ]);
      for (const p of probes) expect(p.error).not.toBeNull();
    },
    TIMEOUT,
  );

  it(
    "H-1.6 the public venue views expose only public fields",
    async () => {
      const gym = await sb.from("gyms_public").select("*").limit(1);
      expect(gym.error).toBeNull();
      const row = (gym.data?.[0] ?? {}) as Record<string, unknown>;
      for (const forbidden of ["qr_code_id", "commission_percentage", "phone"]) {
        expect(Object.keys(row)).not.toContain(forbidden);
      }
    },
    TIMEOUT,
  );

  it.skipIf(!GYM_QR)(
    "H-1.7 a valid gym QR secret yields a token for exactly that gym",
    async () => {
      expect(tokenGymA).toBeTruthy();
      expect(tokenGymAVenue).toBeTruthy();
    },
    TIMEOUT,
  );

  it.skipIf(!GYM_QR)(
    "H-1.8 a gym QR secret cannot be redirected at another venue id",
    async () => {
      const other = [gymA, gymB].find((id) => id && id !== tokenGymAVenue);
      if (!other) return;
      const { status, body } = await venueAccess({
        action: "claim",
        venueType: "gym",
        venueId: other,
        code: GYM_QR,
      });
      expect(status).toBe(403);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );

  it.skipIf(!GYM_QR)(
    "H-1.9 a gym QR secret is not valid as a hotel QR secret",
    async () => {
      const { status, body } = await venueAccess({ action: "claim", venueType: "hotel", code: GYM_QR });
      expect(status).toBe(404);
      expect(body.token).toBeUndefined();
    },
    TIMEOUT,
  );
});

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

  it.skipIf(!GYM_QR)(
    "3. valid Gym A token → Gym A catalogue + availability allowed",
    async () => {
      const cat = await venueAccess({
        action: "catalogue",
        venueType: "gym",
        venueId: tokenGymAVenue,
        token: tokenGymA,
      });
      expect(cat.status).toBe(200);
      expect(Array.isArray(cat.body.services)).toBe(true);

      const avail = await venueAccess({
        action: "availability",
        venueType: "gym",
        venueId: tokenGymAVenue,
        token: tokenGymA,
      });
      expect(avail.status).toBe(200);
      expect(Array.isArray(avail.body.availableDates)).toBe(true);
    },
    TIMEOUT,
  );

  it.skipIf(!GYM_QR)(
    "4. Gym A token → Gym B denied",
    async () => {
      const other = [gymA, gymB].find((id) => id && id !== tokenGymAVenue);
      if (!other) return;
      const { status, body } = await venueAccess({
        action: "catalogue",
        venueType: "gym",
        venueId: other,
        token: tokenGymA,
      });
      expect(status).toBe(403);
      expect(body.reason).toBe("venue_mismatch");
    },
    TIMEOUT,
  );

  it.skipIf(!GYM_QR)(
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

  it.skipIf(!HOTEL_QR)(
    "6. valid Hotel A token → Hotel A allowed",
    async () => {
      const { status, body } = await venueAccess({
        action: "catalogue",
        venueType: "hotel",
        venueId: tokenHotelAVenue,
        token: tokenHotelA,
      });
      expect(status).toBe(200);
      expect(Array.isArray(body.services)).toBe(true);
    },
    TIMEOUT,
  );

  it.skipIf(!HOTEL_QR)(
    "7. Hotel A token → Hotel B denied",
    async () => {
      const other = [hotelA, hotelB].find((id) => id && id !== tokenHotelAVenue);
      if (!other) return;
      const { status } = await venueAccess({
        action: "catalogue",
        venueType: "hotel",
        venueId: other,
        token: tokenHotelA,
      });
      expect(status).toBe(403);
    },
    TIMEOUT,
  );

  it.skipIf(!HOTEL_QR)(
    "8. Hotel A token → gym data denied",
    async () => {
      if (!gymA) return;
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
      const forged = [
        `${btoa(JSON.stringify({ t: "gym", v: gymA ?? FAKE_VENUE, iat: 1, exp: 9999999999, jti: "x" }))}.signature`,
        "not-a-token",
        "",
      ];
      if (tokenGymA) forged.push(`${tokenGymA.slice(0, -2)}AA`);
      for (const token of forged) {
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
        code: "revoked-or-unknown-code-000000",
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
      expect(city?.id).toBeTruthy();
      const { data: services, error } = await sb
        .from("services")
        .select("id, price, home_visit_enabled")
        .eq("home_visit_enabled", true)
        .limit(1);
      expect(error).toBeNull();
      expect(Array.isArray(services)).toBe(true);
    },
    TIMEOUT,
  );
});
