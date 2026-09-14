/**
 * @vitest-environment node
 */

/**
 * HOME VISIT — the migrations apply cleanly ON TOP OF what is deployed today.
 *
 * The two fixes do not create functions from nothing: they replace ones that
 * already exist in production, and two of them change arity:
 *
 *   get_home_booked_slots      (uuid,date)          -> (uuid,date,int)
 *   get_home_available_dates   (uuid,date,int)      -> (uuid,date,int,int)
 *
 * Postgres treats a different argument list as a different function, so
 * without an explicit DROP the old and new versions would coexist and every
 * existing call would fail with "function is not unique". Both migrations
 * drop the superseded arity; these tests prove that, and prove the callers
 * that pass the ORIGINAL number of arguments still resolve afterwards.
 *
 * This mirrors the real upgrade path: the currently-deployed definitions are
 * installed first, then the migrations are applied in filename order.
 *
 * Requires: npm install --no-save @electric-sql/pglite   (skips without it)
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
/** Filename order is the apply order. */
const MIGRATIONS = [
  "supabase/migrations/20260912000000_home_visit_overlap_fix.sql",
  "supabase/migrations/20260912010000_home_visit_dates_consistency.sql",
];

const BASE_SCHEMA = `
CREATE TYPE public.day_of_week AS ENUM
  ('sunday','monday','tuesday','wednesday','thursday','friday','saturday');
CREATE TABLE public.countries (id uuid PRIMARY KEY, name text);
CREATE TABLE public.cities (id uuid PRIMARY KEY, name text, country_id uuid,
  is_active boolean DEFAULT true, home_visit_travel_fee numeric);
CREATE TABLE public.country_financials (country_id uuid,
  home_visit_travel_fee numeric NOT NULL DEFAULT 0);
CREATE TABLE public.services (id uuid PRIMARY KEY, name text, price numeric,
  duration_minutes integer, is_active boolean DEFAULT true,
  home_visit_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE public.therapists (id uuid PRIMARY KEY, name text);
CREATE TABLE public.therapist_cities (therapist_id uuid, city_id uuid);
CREATE TABLE public.therapist_weekly_schedules (therapist_id uuid,
  day_of_week public.day_of_week, start_time time NOT NULL, end_time time NOT NULL,
  is_active boolean DEFAULT true, gym_id uuid, hotel_id uuid);
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
CREATE OR REPLACE FUNCTION public.get_home_travel_fee(_city_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(c.home_visit_travel_fee,
    (SELECT cf.home_visit_travel_fee FROM public.country_financials cf
      WHERE cf.country_id = c.country_id LIMIT 1), 0)
  FROM public.cities c WHERE c.id = _city_id; $$;
`;

/**
 * The definitions live in production right now, copied from migration
 * 20260813201513. These are the ones that compare bare start times.
 */
const DEPLOYED_TODAY = `
CREATE OR REPLACE FUNCTION public.get_home_available_dates(
  p_city_id uuid, p_start_date date DEFAULT CURRENT_DATE, p_months_ahead integer DEFAULT 3)
RETURNS TABLE(available_date date) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  WITH days AS (SELECT gs::date AS d FROM generate_series(
      p_start_date, (p_start_date + make_interval(months => p_months_ahead)), interval '1 day') gs)
  SELECT DISTINCT d FROM days WHERE EXISTS (
    SELECT 1 FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws ON ws.therapist_id = tc.therapist_id
    WHERE tc.city_id = p_city_id AND ws.is_active
      AND ws.day_of_week = public.dow_enum(d)
      AND NOT EXISTS (SELECT 1 FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id AND tl.status='approved'
          AND d BETWEEN tl.start_date AND tl.end_date))
  ORDER BY 1; $$;

CREATE OR REPLACE FUNCTION public.get_home_booked_slots(p_city_id uuid, p_date date)
RETURNS TABLE(slot_time text) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  WITH pool AS (SELECT tc.therapist_id FROM public.therapist_cities tc WHERE tc.city_id = p_city_id),
  pool_size AS (SELECT COUNT(*) n FROM pool),
  busy AS (SELECT to_char(b.booking_time,'HH24:MI') AS t, COUNT(DISTINCT b.therapist_id) AS bc
    FROM public.bookings b WHERE b.booking_date = p_date
      AND b.therapist_id IN (SELECT therapist_id FROM pool)
      AND COALESCE(b.status,'') NOT IN ('cancelled','rescheduled') GROUP BY 1)
  SELECT busy.t FROM busy, pool_size WHERE pool_size.n > 0 AND busy.bc >= pool_size.n; $$;

CREATE OR REPLACE FUNCTION public.check_home_slot_availability(
  p_city_id uuid, p_date date, p_time text, p_duration_minutes integer DEFAULT 60)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws
      ON ws.therapist_id = tc.therapist_id AND ws.day_of_week = public.dow_enum(p_date)
    WHERE tc.city_id = p_city_id AND ws.is_active
      AND (p_time::time) >= ws.start_time AND (p_time::time) < ws.end_time
      AND NOT EXISTS (SELECT 1 FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id AND tl.status='approved'
          AND p_date BETWEEN tl.start_date AND tl.end_date)
      AND NOT EXISTS (SELECT 1 FROM public.bookings b
        WHERE b.therapist_id = tc.therapist_id AND b.booking_date = p_date
          AND to_char(b.booking_time,'HH24:MI') = p_time
          AND COALESCE(b.status,'') NOT IN ('cancelled','rescheduled'))); $$;
`;

const CITY = "11111111-1111-4111-8111-000000000001";
const T = "aaaaaaaa-0000-4000-8000-000000000001";
const S90 = "33333333-0000-4000-8000-000000000090";
const DATE = "2026-09-14"; // Monday

type Db = {
  exec: (s: string) => Promise<unknown>;
  query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

const stripGrants = (sql: string) =>
  sql.split("\n").filter((l) => !/^\s*(GRANT|REVOKE)\b/i.test(l)).join("\n");

/** Install today's production state, then upgrade through the migrations. */
const PGLITE_MODULE = "@electric-sql/pglite";

async function boot(): Promise<{ db: Db; upgrade: () => Promise<void> } | null> {
  let PGlite: new () => Db;
  try {
    ({ PGlite } = (await import(/* @vite-ignore */ PGLITE_MODULE)) as unknown as { PGlite: new () => Db });
  } catch {
    return null;
  }
  const db = new PGlite();
  await db.exec(BASE_SCHEMA);
  await db.exec(DEPLOYED_TODAY);
  await db.exec(`
    INSERT INTO cities VALUES ('${CITY}','Koeln',NULL,true,NULL);
    INSERT INTO services VALUES ('${S90}','Massage 90',95,90,true,true);
    INSERT INTO therapists VALUES ('${T}','T');
    INSERT INTO therapist_cities VALUES ('${T}','${CITY}');
    INSERT INTO therapist_weekly_schedules
      (therapist_id,day_of_week,start_time,end_time,is_active)
      VALUES ('${T}','monday','09:00','18:00',true);
    INSERT INTO bookings (service_id,booking_date,booking_time,therapist_id,status,home_city_id)
      VALUES ('${S90}','${DATE}','11:00','${T}','confirmed','${CITY}');`);

  const upgrade = async () => {
    for (const f of MIGRATIONS) {
      await db.exec(stripGrants(fs.readFileSync(path.join(root, f), "utf8")));
    }
  };
  return { db, upgrade };
}

const booted = await boot();

describe.skipIf(booted === null)("Migrations apply on top of the deployed schema", () => {
  it("upgrade the live definitions in filename order without error", async () => {
    const { db, upgrade } = booted!;

    // The bug, reproduced against the definitions that are live right now:
    // a 90-minute booking at 11:00 runs to 12:30, yet 12:00 reads as free.
    const before = (await db.query(
      `SELECT public.check_home_slot_availability($1,$2,'12:00',50) ok`, [CITY, DATE])).rows[0].ok;
    expect(before).toBe(true);

    await upgrade(); // must not throw

    const after = (await db.query(
      `SELECT public.check_home_slot_availability($1,$2,'12:00',50) ok`, [CITY, DATE])).rows[0].ok;
    expect(after).toBe(false);
  });

  it("leaves exactly one overload of each changed function", async () => {
    const { db } = booted!;
    const count = async (name: string) =>
      (await db.query(
        `SELECT count(*)::int n FROM pg_proc p
           JOIN pg_namespace ns ON ns.oid = p.pronamespace
          WHERE ns.nspname='public' AND p.proname=$1`, [name])).rows[0].n as number;

    // More than one would make every existing call ambiguous.
    expect(await count("get_home_booked_slots")).toBe(1);
    expect(await count("get_home_available_dates")).toBe(1);
    expect(await count("check_home_slot_availability")).toBe(1);
    expect(await count("create_home_booking_atomic")).toBe(1);
    expect(await count("home_free_therapists")).toBe(1);
  });

  it("callers passing the original argument count still resolve", async () => {
    const { db } = booted!;
    // useHomeBookedSlots(cityId, date) — two arguments, as before.
    await expect(
      db.query(`SELECT * FROM public.get_home_booked_slots($1,$2)`, [CITY, DATE]),
    ).resolves.toBeTruthy();
    // useHomeAvailableDates(cityId, startDate, monthsAhead) — three, as before.
    await expect(
      db.query(`SELECT * FROM public.get_home_available_dates($1,$2,1)`, [CITY, DATE]),
    ).resolves.toBeTruthy();
    // create-payment's four-argument availability gate.
    await expect(
      db.query(`SELECT public.check_home_slot_availability($1,$2,'12:00',50)`, [CITY, DATE]),
    ).resolves.toBeTruthy();
  });

  it("is idempotent: applying both migrations twice changes nothing", async () => {
    const { db, upgrade } = booted!;
    await upgrade(); // second application must not throw
    const n = (await db.query(
      `SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
        WHERE ns.nspname='public' AND p.proname='get_home_booked_slots'`)).rows[0].n;
    expect(n).toBe(1);
    const still = (await db.query(
      `SELECT public.check_home_slot_availability($1,$2,'12:00',50) ok`, [CITY, DATE])).rows[0].ok;
    expect(still).toBe(false);
  });
});
