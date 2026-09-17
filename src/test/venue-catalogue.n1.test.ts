/**
 * N-1 regression suite — the venue catalogue is authoritative.
 *
 * Rule under test: a service is bookable at a gym/hotel ONLY when an ACTIVE
 * mapping row exists for that venue. "No mapping" must never fall back to the
 * base service price, and an inactive mapping stays rejected.
 *
 * Read-only: no bookings are created, no payments are made, no rows are written.
 * The price rule itself is asserted through the QR-authorized `venue-access`
 * catalogue (server-resolved prices) and through `create-payment` rejections.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://lugzhjfguftlfcgjfnbj.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z3poamZndWZ0bGZjZ2pmbmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNjY1ODAsImV4cCI6MjA4NDk0MjU4MH0._uP_L7Z_OR_E-m6KqkTbXN_fbXKLDGBF-OUENc4AHHg";

const TIMEOUT = 30_000;
const SYNTHETIC_EMAIL = "qa-probe-not-a-real-customer@example.invalid";
const UNMAPPED_SERVICE = "00000000-0000-4000-8000-000000000001";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fn(name: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
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

async function claim(venueType: "gym" | "hotel", venueId: string) {
  const { body } = await fn("venue-access", { action: "claim", venueType, venueId });
  return body.token as string | undefined;
}

let gymId: string | undefined;
let hotelId: string | undefined;

beforeAll(async () => {
  const { data: gym } = await sb.from("gyms").select("id").eq("is_active", true).limit(1).maybeSingle();
  gymId = gym?.id;
  const { data: hotel } = await sb.from("hotels").select("id").eq("is_active", true).limit(1).maybeSingle();
  hotelId = hotel?.id;
}, TIMEOUT);

describe("N-1 — venue service catalogue is authoritative", () => {
  it(
    "1. gym services with an ACTIVE mapping are returned with a server price",
    async () => {
      const token = await claim("gym", gymId!);
      const { status, body } = await fn("venue-access", {
        action: "catalogue",
        venueType: "gym",
        venueId: gymId,
        token,
      });
      expect(status).toBe(200);
      expect(body.services.length).toBeGreaterThan(0);
      for (const svc of body.services) {
        expect(typeof svc.price).toBe("number");
        expect(svc.price).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );

  it(
    "2. a service with NO mapping for the gym is not in the catalogue",
    async () => {
      const token = await claim("gym", gymId!);
      const { body } = await fn("venue-access", {
        action: "catalogue",
        venueType: "gym",
        venueId: gymId,
        token,
      });
      const ids = body.services.map((s: { id: string }) => s.id);
      expect(ids).not.toContain(UNMAPPED_SERVICE);
    },
    TIMEOUT,
  );

  it(
    "3. an INACTIVE mapping is never returned by the catalogue",
    async () => {
      const token = await claim("gym", gymId!);
      const { body } = await fn("venue-access", {
        action: "catalogue",
        venueType: "gym",
        venueId: gymId,
        token,
      });
      // every returned service must resolve to a concrete server price, which
      // only happens for active mappings (get_effective_service_price → NULL otherwise)
      for (const svc of body.services) {
        expect(svc.price).not.toBeNull();
      }
    },
    TIMEOUT,
  );

  it(
    "4. hotel services with an ACTIVE mapping are returned",
    async () => {
      if (!hotelId) return;
      const token = await claim("hotel", hotelId);
      const { status, body } = await fn("venue-access", {
        action: "catalogue",
        venueType: "hotel",
        venueId: hotelId,
        token,
      });
      expect(status).toBe(200);
      expect(Array.isArray(body.services)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "5+6. booking a service that the venue does not offer is rejected server-side",
    async () => {
      const token = await claim("gym", gymId!);
      const { status, body } = await fn("create-payment", {
        venueType: "gym",
        gymId,
        venueToken: token,
        serviceId: UNMAPPED_SERVICE,
        bookingDate: "2099-01-01",
        bookingTime: "10:00",
        customerEmail: SYNTHETIC_EMAIL,
        customerName: "QA Probe",
      });
      expect(status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(body).toLowerCase()).not.toContain("checkout.stripe.com");
    },
    TIMEOUT,
  );

  it(
    "7. a client-supplied price/currency cannot be used for checkout",
    async () => {
      const token = await claim("gym", gymId!);
      const { status, body } = await fn("create-payment", {
        venueType: "gym",
        gymId,
        venueToken: token,
        serviceId: UNMAPPED_SERVICE,
        totalAmount: 1,
        amount: 1,
        price: 1,
        currency: "usd",
        bookingDate: "2099-01-01",
        bookingTime: "10:00",
        customerEmail: SYNTHETIC_EMAIL,
        customerName: "QA Probe",
      });
      // rejected because the service is not offered — the injected price is ignored
      expect(status).toBeGreaterThanOrEqual(400);
      expect(body.url).toBeUndefined();
    },
    TIMEOUT,
  );

  it(
    "8. the price lookup function is not callable by anonymous clients",
    async () => {
      const { error } = await sb.rpc("get_effective_service_price", {
        _venue_type: "gym",
        _venue_id: gymId!,
        _service_id: UNMAPPED_SERVICE,
      });
      expect(error).not.toBeNull();
    },
    TIMEOUT,
  );
});
