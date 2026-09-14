/**
 * @vitest-environment node
 *
 * The suite default is jsdom (component tests need a DOM). PGlite loads its
 * Postgres WASM through APIs jsdom does not implement, so this file opts back
 * out to node.
 */

/**
 * HOME VISIT — booking-conflict rules executed against a real Postgres.
 *
 * These run the ACTUAL migration files against an in-process Postgres
 * (PGlite), so they test the shipped SQL rather than a re-description of it.
 * That matters here: the bug being guarded lived inside SQL, which every
 * TypeScript-level test happily mocked away.
 *
 * WHAT WAS BROKEN
 * ---------------
 * Availability compared only start times, so service duration was invisible.
 * Run against these same cases before the fix, 5 of 10 gave the wrong answer —
 * including a therapist mid-session at a gym or hotel being offered for an
 * overlapping home visit.
 *
 * RUNNING THEM
 * ------------
 * PGlite is deliberately NOT a project dependency: it is only needed to
 * exercise SQL locally, and adding it would change the dependency set the
 * Lovable sync manages. Install it on demand:
 *
 *     npm install --no-save @electric-sql/pglite
 *
 * Without it these suites skip rather than fail, so CI is never broken by its
 * absence.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const MIGRATIONS = [
  "supabase/migrations/20260912000000_home_visit_overlap_fix.sql",
  "supabase/migrations/20260912010000_home_visit_dates_consistency.sql",
];

/** Only the columns these functions touch, mirroring the production schema. */
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

const KOLN = "11111111-1111-4111-8111-111111111111";
const DUS = "11111111-1111-4111-8111-222222222222";
const DE = "22222222-2222-4222-8222-222222222222";
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const S30 = "33333333-0000-4000-8000-000000000030";
const S90 = "33333333-0000-4000-8000-000000000090";
/** A Monday, matching the weekly schedules seeded below. */
const DATE = "2026-09-14";

const SEED = `
INSERT INTO countries VALUES ('${DE}','Germany');
INSERT INTO cities VALUES ('${KOLN}','Koeln','${DE}',true,NULL),
                          ('${DUS}','Duesseldorf','${DE}',true,NULL);
INSERT INTO services VALUES ('${S30}','Massage 30',30,30,true,true),
                            ('${S90}','Massage 90',95,90,true,true);
INSERT INTO therapists VALUES ('${A}','A'),('${B}','B'),('${C}','C');
INSERT INTO therapist_cities VALUES ('${A}','${KOLN}'),('${B}','${KOLN}'),('${C}','${DUS}');
INSERT INTO therapist_weekly_schedules VALUES
  ('${A}','monday','09:00','18:00',true),
  ('${B}','monday','09:00','18:00',true),
  ('${C}','monday','09:00','18:00',true);
`;

type Db = {
  exec: (s: string) => Promise<unknown>;
  query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

/** anon/authenticated roles do not exist in a bare instance. */
const GRANT_LINE = /^\s*(GRANT|REVOKE)\b/i;
const stripGrants = (sql: string) =>
  sql.split("\n").filter((l) => !GRANT_LINE.test(l)).join("\n");

/**
 * Resolved at module load rather than in beforeAll: describe.skipIf() is
 * evaluated during collection, so the decision must already be made.
 */
const PGLITE_MODULE = "@electric-sql/pglite";

async function boot(): Promise<Db | null> {
  let PGlite: new () => Db;
  try {
    ({ PGlite } = (await import(/* @vite-ignore */ PGLITE_MODULE)) as unknown as { PGlite: new () => Db });
  } catch {
    return null; // not installed — every suite below skips
  }
  const d = new PGlite();
  await d.exec(SCHEMA);
  for (const f of MIGRATIONS) {
    await d.exec(stripGrants(fs.readFileSync(path.join(root, f), "utf8")));
  }
  await d.exec(SEED);
  return d;
}

const db = await boot();

/** Is any therapist offered for this slot? */
async function available(city: string, time: string, duration: number) {
  const r = await db!.query(`SELECT public.check_home_slot_availability($1,$2,$3,$4) ok`, [
    city,
    DATE,
    time,
    duration,
  ]);
  return r.rows[0].ok as boolean;
}

/** Occupy BOTH Koeln therapists at `time` with `service`, at the given venue. */
async function occupyPool(time: string, service: string, venue: "home" | "gym" | "hotel") {
  const col = venue === "home" ? "home_city_id" : venue === "gym" ? "gym_id" : "hotel_id";
  const val = venue === "home" ? KOLN : DE;
  await db!.exec(`DELETE FROM bookings;
    INSERT INTO bookings (service_id,booking_date,booking_time,therapist_id,status,${col})
    VALUES ('${service}','${DATE}','${time}','${A}','confirmed','${val}'),
           ('${service}','${DATE}','${time}','${B}','confirmed','${val}');`);
}

describe.skipIf(db === null)("Home visit conflicts — real Postgres", () => {
  it("the reported case: pool busy 11:00 to 11:30, 11:00 is not offered", async () => {
    await occupyPool("11:00", S30, "home");
    expect(await available(KOLN, "11:00", 50)).toBe(false);
  });

  it("OVERLAP: a 90-minute visit from 11:00 blocks 12:00", async () => {
    // The core regression. Start times differ, so the old exact-match check
    // reported "free" and the writer double-booked the therapist.
    await occupyPool("11:00", S90, "home");
    expect(await available(KOLN, "12:00", 50)).toBe(false);
  });

  it("ADJACENT: a session ending 11:30 blocks 11:30 but not 11:45", async () => {
    await occupyPool("11:00", S30, "home");
    expect(await available(KOLN, "11:30", 50)).toBe(false); // inside the 5-minute buffer
    expect(await available(KOLN, "11:45", 50)).toBe(true);
  });

  it("DIFFERENT THERAPIST: one busy therapist does not close the slot", async () => {
    await db!.exec(`DELETE FROM bookings;
      INSERT INTO bookings (service_id,booking_date,booking_time,therapist_id,status,home_city_id)
      VALUES ('${S90}','${DATE}','11:00','${A}','confirmed','${KOLN}');`);
    expect(await available(KOLN, "12:00", 50)).toBe(true);
  });

  it("DIFFERENT CITY: a fully booked Koeln pool does not affect Duesseldorf", async () => {
    await occupyPool("11:00", S90, "home");
    expect(await available(DUS, "12:00", 50)).toBe(true);
  });

  it("GYM to HOME: a therapist mid-session at a gym is not offered at home", async () => {
    await occupyPool("11:00", S90, "gym");
    expect(await available(KOLN, "12:00", 50)).toBe(false);
  });

  it("HOTEL to HOME: a therapist mid-session at a hotel is not offered at home", async () => {
    await occupyPool("11:00", S90, "hotel");
    expect(await available(KOLN, "12:00", 50)).toBe(false);
  });

  it("the whole session must fit the shift: 90 minutes at 17:00 is refused", async () => {
    await db!.exec(`DELETE FROM bookings;`);
    expect(await available(KOLN, "17:00", 90)).toBe(false);
    expect(await available(KOLN, "16:00", 90)).toBe(true);
  });

  it("cancelled and rescheduled bookings never block a slot", async () => {
    await db!.exec(`DELETE FROM bookings;
      INSERT INTO bookings (service_id,booking_date,booking_time,therapist_id,status,home_city_id)
      VALUES ('${S90}','${DATE}','11:00','${A}','cancelled','${KOLN}'),
             ('${S90}','${DATE}','11:00','${B}','rescheduled','${KOLN}');`);
    expect(await available(KOLN, "12:00", 50)).toBe(true);
  });

  it("an approved leave removes a therapist from the pool", async () => {
    await db!.exec(`DELETE FROM bookings; DELETE FROM therapist_leaves;
      INSERT INTO therapist_leaves VALUES
        ('${A}','${DATE}','${DATE}','approved'),
        ('${B}','${DATE}','${DATE}','approved');`);
    expect(await available(KOLN, "12:00", 50)).toBe(false);
    await db!.exec(`DELETE FROM therapist_leaves;`);
  });
});

describe.skipIf(db === null)("create_home_booking_atomic — the only insert path", () => {
  const book = async (time: string, session: string) => {
    try {
      const r = await db!.query(
        `SELECT public.create_home_booking_atomic($1,$2,$3,$4,$5,$6,
           NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'paid',$7,NULL,NULL,NULL) id`,
        [S90, DATE, time, "c@example.com", KOLN, DE, session],
      );
      return { ok: true, id: r.rows[0].id as string, error: "" };
    } catch (e) {
      return { ok: false, id: "", error: (e as Error).message };
    }
  };

  it("refuses a therapist who is mid-session, and stays idempotent", async () => {
    // Pool of exactly one, so there is no second therapist to fall back to.
    await db!.exec(`DELETE FROM bookings; DELETE FROM therapist_cities;
      INSERT INTO therapist_cities VALUES ('${A}','${KOLN}');`);

    const first = await book("11:00", "sess-1"); // 11:00 to 12:30
    expect(first.ok).toBe(true);

    const overlapping = await book("12:00", "sess-2");
    expect(overlapping.ok).toBe(false);
    expect(overlapping.error).toContain("SLOT_UNAVAILABLE");

    // 12:30 end plus the 5-minute buffer.
    expect((await book("12:35", "sess-3")).ok).toBe(true);

    // Replaying a Stripe session returns the original row, never a duplicate.
    const replay = await book("11:00", "sess-1");
    expect(replay.id).toBe(first.id);

    const rows = await db!.query(`SELECT count(*)::int n FROM bookings`);
    expect(rows.rows[0].n).toBe(2);

    await db!.exec(`INSERT INTO therapist_cities VALUES ('${B}','${KOLN}');`);
  });
});

describe.skipIf(db === null)("get_home_available_dates — no date without a bookable slot", () => {
  const dateCount = async () =>
    (
      await db!.query(`SELECT count(*)::int n FROM public.get_home_available_dates($1,$2,1)`, [
        KOLN,
        DATE,
      ])
    ).rows[0].n as number;

  it("offers dates for a usable window and none for a degenerate one", async () => {
    await db!.exec(`DELETE FROM bookings;
      UPDATE therapist_weekly_schedules SET start_time='09:00', end_time='18:00';`);
    expect(await dateCount()).toBeGreaterThan(0);

    // The signature observed live in Koeln: dates offered, not one slot bookable.
    await db!.exec(`UPDATE therapist_weekly_schedules SET start_time=NULL, end_time=NULL;`);
    expect(await dateCount()).toBe(0);

    // Window too short to hold a session.
    await db!.exec(`UPDATE therapist_weekly_schedules SET start_time='09:00', end_time='09:30';`);
    expect(await dateCount()).toBe(0);

    await db!.exec(`UPDATE therapist_weekly_schedules SET start_time='09:00', end_time='18:00';`);
  });
});

describe.skipIf(db === null)("get_home_booked_slots — duration aware", () => {
  it("a longer service blocks a superset of what a shorter one blocks", async () => {
    await db!.exec(`DELETE FROM bookings; DELETE FROM therapist_cities;
      UPDATE therapist_weekly_schedules SET start_time='09:00', end_time='18:00';
      INSERT INTO therapist_cities VALUES ('${A}','${KOLN}');
      INSERT INTO bookings (service_id,booking_date,booking_time,therapist_id,status,home_city_id)
      VALUES ('${S90}','${DATE}','11:00','${A}','confirmed','${KOLN}');`);

    const blocked = async (d: number) =>
      new Set(
        (
          await db!.query(`SELECT slot_time FROM public.get_home_booked_slots($1,$2,$3)`, [
            KOLN,
            DATE,
            d,
          ])
        ).rows.map((r) => r.slot_time as string),
      );

    const short = await blocked(50);
    const long = await blocked(90);
    expect(short.size).toBeGreaterThan(0);
    for (const s of short) expect(long.has(s)).toBe(true);
    expect(long.size).toBeGreaterThan(short.size);
  });
});
