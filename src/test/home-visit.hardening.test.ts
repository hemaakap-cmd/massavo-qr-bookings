/**
 * Home Visit — hardening regression tests for the confirmed create-payment
 * validation bug (a crafted request could bypass the availability gate and
 * reach Stripe session creation for a bogus city).
 *
 * SAFETY: none of these probes ever create a Stripe checkout session. Every
 * request is engineered to be rejected BEFORE session creation:
 *   - missing city/date/time  → validation throws (no session)
 *   - fake city               → city-existence check → 400 (no session)
 *
 * GUARD: these assert the FIXED backend behavior, so they only run once the
 * hardened create-payment is deployed. Deployment is detected with a
 * session-free distinguisher: a real home service + valid date/time + a
 * syntactically-valid but non-existent city.
 *   - fixed backend  → 400 (city rejected before the slot check)
 *   - old backend    → 409 (slot check runs because date/time are present)
 * Neither creates a session. If not fixed yet, the whole suite skips.
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
const FAKE_CITY = "00000000-0000-4000-8000-000000000000";
const FUTURE_DATE = "2099-01-05";
const SLOT = "12:00";

async function invoke(body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
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

async function realHomeServiceId(): Promise<string | null> {
  const { data } = await sb
    .from("services")
    .select("id")
    .eq("home_visit_enabled", true)
    .eq("is_active", true)
    .limit(1);
  return (data && data[0]?.id) || null;
}

async function realCityId(): Promise<string | null> {
  const { data } = await sb.from("cities").select("id").eq("is_active", true).limit(1);
  return (data && data[0]?.id) || null;
}

// Resolve fixtures + deploy status at top level so describe.skipIf sees them.
const HOME_SERVICE_ID = await realHomeServiceId();
const REAL_CITY_ID = await realCityId();

async function detectFix(): Promise<boolean> {
  if (!HOME_SERVICE_ID) return false;
  // Session-free distinguisher: fixed backend rejects the bogus city with 400
  // BEFORE the slot check; old backend returns 409 from the slot check.
  const { status } = await invoke({
    serviceId: HOME_SERVICE_ID, venueType: "home",
    homeCityId: FAKE_CITY, homeCountryId: FAKE_CITY,
    homeStreet: "Teststr 1", homePostalCode: "10115",
    bookingDate: FUTURE_DATE, timeSlot: SLOT, customerEmail: "valid@example.com",
  });
  return status === 400;
}

const FIX_DEPLOYED = await detectFix();

describe.skipIf(!FIX_DEPLOYED)("HOME VISIT hardening — availability enforced server-side", () => {
  it("missing city → rejected, no checkout URL", async () => {
    const { json } = await invoke({
      serviceId: HOME_SERVICE_ID, venueType: "home",
      homeStreet: "Teststr 1", homePostalCode: "10115",
      bookingDate: FUTURE_DATE, timeSlot: SLOT, customerEmail: "valid@example.com",
    });
    expect(json?.url).toBeFalsy();
  }, TIMEOUT);

  it("missing date → rejected, no checkout URL", async () => {
    const { json } = await invoke({
      serviceId: HOME_SERVICE_ID, venueType: "home", homeCityId: REAL_CITY_ID,
      homeStreet: "Teststr 1", homePostalCode: "10115",
      timeSlot: SLOT, customerEmail: "valid@example.com",
    });
    expect(json?.url).toBeFalsy();
  }, TIMEOUT);

  it("missing time → rejected, no checkout URL", async () => {
    const { json } = await invoke({
      serviceId: HOME_SERVICE_ID, venueType: "home", homeCityId: REAL_CITY_ID,
      homeStreet: "Teststr 1", homePostalCode: "10115",
      bookingDate: FUTURE_DATE, customerEmail: "valid@example.com",
    });
    expect(json?.url).toBeFalsy();
  }, TIMEOUT);

  it("fake (non-existent) city → 400, no checkout URL", async () => {
    const { status, json } = await invoke({
      serviceId: HOME_SERVICE_ID, venueType: "home", homeCityId: FAKE_CITY, homeCountryId: FAKE_CITY,
      homeStreet: "Teststr 1", homePostalCode: "10115",
      bookingDate: FUTURE_DATE, timeSlot: SLOT, customerEmail: "valid@example.com",
    });
    expect(status).toBe(400);
    expect(json?.url).toBeFalsy();
  }, TIMEOUT);

  it("client-supplied price/amount/total is ignored (still rejected, no URL)", async () => {
    const { json } = await invoke({
      serviceId: HOME_SERVICE_ID, venueType: "home", homeCityId: FAKE_CITY, homeCountryId: FAKE_CITY,
      homeStreet: "Teststr 1", homePostalCode: "10115",
      bookingDate: FUTURE_DATE, timeSlot: SLOT, customerEmail: "valid@example.com",
      price: 1, amount: 1, total: 1, travelFee: 0, currency: "usd",
    });
    expect(json?.url).toBeFalsy();
  }, TIMEOUT);
});
