/**
 * @vitest-environment node
 *
 * QA-2 — HOME VISIT end-of-shift rule, verified verbatim against real Postgres.
 *
 * Rule under test (exactly as specified):
 *     booking_start_time + service_duration <= therapist_shift_end_time
 *
 * With a 21:00 shift end:
 *     20:30 + 25min  -> valid    (ends 20:55)
 *     20:30 + 90min  -> INVALID  (ends 22:00)
 *     20:50 + 25min  -> INVALID  (ends 21:15)
 *     20:59 + any    -> INVALID
 *
 * This runs the ACTUAL migration files against an in-process Postgres (PGlite),
 * so it proves the shipped SQL — not a re-description of it. PGlite is a
 * dev-only dependency; without it the suite skips rather than fails.
 *
 * NOTE ON PRODUCTION: this proves the fix LOGIC. As of 2026-09-17 the migration
 * (20260912000000_home_visit_overlap_fix.sql) was verified NOT applied to the
 * production database — check_home_slot_availability there still accepted a
 * 1440-minute booking. Deploying the pending DB migrations is what makes this
 * live; this test then also passes against production via the sibling
 * home-visit.overlap.test.ts (which self-activates once deployed).
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const MIGRATIONS = [
  "supabase/migrations/20260912000000_home_visit_overlap_fix.sql",
  "supabase/migrations/20260912010000_home_visit_dates_consistency.sql",
];

const SCHEMA = `
CREATE TYPE public.day_of_week AS ENUM
  ('sunday','monday','tuesday','wednesday','thursday','friday','saturday');
CREATE TABLE public.countries (id uuid PRIMARY KEY, name text);
CREATE TABLE public.cities (id uuid PRIMARY KEY, name text, country_id uuid,
  is_active boolean DEFAULT true, home_visit_travel_fee numeric);
CREATE TABLE public.services (id uuid PRIMARY KEY, name text, price numeric,
  duration_minutes integer, is_active boolean DEFAULT true,
  home_visit_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.therapists (id uuid PRIMARY KEY, name text);
CREATE TABLE public.therapist_cities (therapist_id uuid, city_id uuid);
CREATE TABLE public.therapist_weekly_schedules (therapist_id uuid,
  day_of_week public.day_of_week, start_time time, end_time time,
  is_active boolean DEFAULT true);
CREATE TABLE public.therapist_leaves (therapist_id uuid, start_date date,
  end_date date, status text);
CREATE TABLE public.bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid, booking_date date, booking_time time, customer_email text,
  gym_id uuid, hotel_id uuid, home_city_id uuid, home_country_id uuid,
  home_street text, home_house_no text, home_postal_code text,
  home_address_notes text, customer_name text, client_phone text,
  client_age integer, date_of_birth date, salutation text, gender text,
  health_confirmed boolean, therapist_id uuid, status text,
  payment_status text, stripe_session_id text, total_amount numeric,
  cancellation_token text, user_id uuid);
CREATE OR REPLACE FUNCTION public.dow_enum(_d date) RETURNS public.day_of_week
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])
    [EXTRACT(DOW FROM _d)::int + 1]::public.day_of_week; $$;
`;

const CITY = "11111111-1111-4111-8111-111111111111";
const DE = "22222222-2222-4222-8222-222222222222";
const T = "aaaaaaaa-0000-4000-8000-000000000001";
const S25 = "33333333-0000-4000-8000-000000000025";
const S90 = "33333333-0000-4000-8000-000000000090";
/** A Monday. Therapist shift 17:00-21:00, matching the QA-2 example. */
const DATE = "2026-09-14";

const SEED = `
INSERT INTO countries VALUES ('${DE}','Germany');
INSERT INTO cities VALUES ('${CITY}','Koeln','${DE}',true,NULL);
INSERT INTO services VALUES ('${S25}','Massage 25',30,25,true,true),
                            ('${S90}','Massage 90',139,90,true,true);
INSERT INTO therapists VALUES ('${T}','T');
INSERT INTO therapist_cities VALUES ('${T}','${CITY}');
INSERT INTO therapist_weekly_schedules VALUES ('${T}','monday','17:00','21:00',true);
`;

type Db = { exec: (s: string) => Promise<unknown>; query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; };
const stripGrants = (sql: string) => sql.split("\n").filter((l) => !/^\s*(GRANT|REVOKE)\b/i.test(l)).join("\n");

async function boot(): Promise<Db | null> {
  let PGlite: new () => Db;
  try {
    // Optional peer dep: resolved at runtime only, so keep the specifier non-literal
    // to avoid a hard TypeScript module resolution requirement.
    const spec = "@electric-sql/pglite";
    ({ PGlite } = (await import(/* @vite-ignore */ spec)) as unknown as { PGlite: new () => Db });
  } catch {
    return null;
  }
  const d = new PGlite();
  await d.exec(SCHEMA);
  for (const f of MIGRATIONS) await d.exec(stripGrants(fs.readFileSync(path.join(root, f), "utf8")));
  await d.exec(SEED);
  return d;
}

const db = await boot();

async function available(time: string, duration: number): Promise<boolean> {
  const r = await db!.query(`SELECT public.check_home_slot_availability($1,$2,$3,$4) ok`, [CITY, DATE, time, duration]);
  return r.rows[0].ok as boolean;
}

describe.skipIf(db === null)("QA-2 — home visit: whole session must fit the shift (ends 21:00)", () => {
  it("20:30 + 25min is VALID (ends 20:55)", async () => {
    expect(await available("20:30", 25)).toBe(true);
  });
  it("20:30 + 90min is INVALID (ends 22:00)", async () => {
    expect(await available("20:30", 90)).toBe(false);
  });
  it("20:50 + 25min is INVALID (ends 21:15)", async () => {
    expect(await available("20:50", 25)).toBe(false);
  });
  it("20:59 + a real service duration is INVALID (25/50/90 all overrun 21:00)", async () => {
    expect(await available("20:59", 25)).toBe(false);
    expect(await available("20:59", 50)).toBe(false);
    expect(await available("20:59", 90)).toBe(false);
  });
  it("boundary is inclusive: a session ending exactly at 21:00 fits (20:59 + 1min)", async () => {
    // start + duration <= shift_end, so ending exactly on the boundary is valid.
    expect(await available("20:59", 1)).toBe(true);
  });
  it("a slot fully inside the shift stays bookable (18:00 + 25min)", async () => {
    expect(await available("18:00", 25)).toBe(true);
  });
  it("exact-fit boundary: 20:35 + 25min ends exactly 21:00 and is VALID", async () => {
    expect(await available("20:35", 25)).toBe(true);
  });
});
