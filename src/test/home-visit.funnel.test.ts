/**
 * @vitest-environment node
 *
 * PGlite hosts Postgres in-process, which jsdom cannot do.
 */

/**
 * HOME VISIT — the complete booking funnel, end to end, on a real Postgres.
 *
 * Walks every step the customer actually goes through:
 *
 *   city -> service -> duration -> date -> time -> price (+ travel fee)
 *        -> therapist assignment -> booking -> confirmation row
 *
 * using the real migration files and the same RPCs the page and
 * create-payment call, in the same order.
 *
 * Two states are covered, because production is currently in the second one:
 *
 *   HEALTHY DATA   — therapists have real working hours. The funnel must
 *                    complete and produce a confirmed booking.
 *   PRODUCTION DATA — the Köln pool's weekly schedule window is degenerate
 *                    (start_time >= end_time). Verified live on 2026-09-12:
 *                    53 dates offered, and a sweep of all 1440 minutes of the
 *                    first date found zero bookable minutes. The funnel must
 *                    then say "no availability" at the DATE step rather than
 *                    letting the customer reach payment and fail with a 409.
 *
 * Requires: npm install --no-save @electric-sql/pglite   (skips without it)
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
CREATE TABLE public.countries (id uuid PRIMARY KEY, name text, currency_code text);
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
-- Prerequisites created by the earlier home-visit migration
-- (20260813201513) and already live. The two migrations under test build on
-- them without redefining them.
CREATE OR REPLACE FUNCTION public.dow_enum(_d date) RETURNS public.day_of_week
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])
    [EXTRACT(DOW FROM _d)::int + 1]::public.day_of_week; $$;
CREATE OR REPLACE FUNCTION public.get_home_travel_fee(_city_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    c.home_visit_travel_fee,
    (SELECT cf.home_visit_travel_fee FROM public.country_financials cf
      WHERE cf.country_id = c.country_id LIMIT 1),
    0)
  FROM public.cities c WHERE c.id = _city_id; $$;
`;

const DE = "22222222-2222-4222-8222-000000000001";
/** Four cities, mirroring the live set. */
const CITY = {
  koeln: "11111111-1111-4111-8111-000000000001",
  leverkusen: "11111111-1111-4111-8111-000000000002",
  bergisch: "11111111-1111-4111-8111-000000000003",
  duesseldorf: "11111111-1111-4111-8111-000000000004",
};
const THERAPIST = {
  koeln: "aaaaaaaa-0000-4000-8000-000000000001",
  leverkusen: "aaaaaaaa-0000-4000-8000-000000000002",
  bergisch: "aaaaaaaa-0000-4000-8000-000000000003",
  duesseldorf: "aaaaaaaa-0000-4000-8000-000000000004",
};
const S50 = "33333333-0000-4000-8000-000000000050";
const S90 = "33333333-0000-4000-8000-000000000090";
/** A Monday. */
const DATE = "2026-09-14";

type Db = {
  exec: (s: string) => Promise<unknown>;
  query: (s: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

const stripGrants = (sql: string) =>
  sql.split("\n").filter((l) => !/^\s*(GRANT|REVOKE)\b/i.test(l)).join("\n");

async function boot(): Promise<Db | null> {
  let PGlite: new () => Db;
  try {
    ({ PGlite } = (await import("@electric-sql/pglite")) as unknown as { PGlite: new () => Db });
  } catch {
    return null;
  }
  const d = new PGlite();
  await d.exec(SCHEMA);
  for (const f of MIGRATIONS) {
    await d.exec(stripGrants(fs.readFileSync(path.join(root, f), "utf8")));
  }
  await d.exec(`
    INSERT INTO countries VALUES ('${DE}','Germany','EUR');
    INSERT INTO country_financials VALUES ('${DE}', 12);
    INSERT INTO cities VALUES
      ('${CITY.koeln}','Koeln','${DE}',true,NULL),
      ('${CITY.leverkusen}','Leverkusen','${DE}',true,NULL),
      ('${CITY.bergisch}','Bergisch Gladbach','${DE}',true,NULL),
      ('${CITY.duesseldorf}','Duesseldorf','${DE}',true,25);
    INSERT INTO services VALUES
      ('${S50}','Klassische Massage 50',55,50,true,true),
      ('${S90}','Klassische Massage 90',95,90,true,true);
    INSERT INTO therapists VALUES
      ('${THERAPIST.koeln}','T-Koeln'),('${THERAPIST.leverkusen}','T-Lev'),
      ('${THERAPIST.bergisch}','T-Berg'),('${THERAPIST.duesseldorf}','T-Dus');
    INSERT INTO therapist_cities VALUES
      ('${THERAPIST.koeln}','${CITY.koeln}'),
      ('${THERAPIST.leverkusen}','${CITY.leverkusen}'),
      ('${THERAPIST.bergisch}','${CITY.bergisch}'),
      ('${THERAPIST.duesseldorf}','${CITY.duesseldorf}');
    INSERT INTO therapist_weekly_schedules
      (therapist_id, day_of_week, start_time, end_time, is_active)
    VALUES
      ('${THERAPIST.koeln}','monday','09:00','18:00',true),
      ('${THERAPIST.leverkusen}','monday','09:00','18:00',true),
      ('${THERAPIST.bergisch}','monday','09:00','18:00',true),
      ('${THERAPIST.duesseldorf}','monday','09:00','18:00',true);`);
  return d;
}

const db = await boot();

/** The customer-facing slot grid on the Home Visit page. */
const SLOTS = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00"];

/** Walk the funnel exactly as the page and create-payment do. */
async function bookHomeVisit(cityId: string, serviceId: string, opts: { session: string }) {
  // 1. service -> duration + price
  const svc = (await db!.query(
    `SELECT price, duration_minutes FROM services WHERE id = $1 AND is_active AND home_visit_enabled`,
    [serviceId],
  )).rows[0];
  if (!svc) return { step: "service", ok: false as const };
  const duration = svc.duration_minutes as number;

  // 2. dates (useHomeAvailableDates)
  // Format in SQL: the driver hands back a JS Date, whose default string form
  // is not ISO and would never match DATE.
  const dates = (await db!.query(
    `SELECT to_char(available_date,'YYYY-MM-DD') d FROM public.get_home_available_dates($1,$2,1,$3)`,
    [cityId, DATE, duration],
  )).rows.map((r) => r.d as string);
  if (!dates.includes(DATE)) return { step: "date", ok: false as const, dates };

  // 3. slots the picker greys out (useHomeBookedSlots)
  const blocked = new Set(
    (await db!.query(`SELECT slot_time FROM public.get_home_booked_slots($1,$2,$3)`, [cityId, DATE, duration]))
      .rows.map((r) => r.slot_time as string),
  );
  const offered = SLOTS.filter((s) => !blocked.has(s));
  if (offered.length === 0) return { step: "time", ok: false as const, offered };

  // 4. the server gate create-payment applies before creating a Stripe session
  const chosen = offered[0];
  const gate = (await db!.query(`SELECT public.check_home_slot_availability($1,$2,$3,$4) ok`,
    [cityId, DATE, chosen, duration])).rows[0].ok as boolean;
  if (!gate) return { step: "gate", ok: false as const, chosen };

  // 5. price, exactly as create-payment builds it
  const fee = Number((await db!.query(`SELECT public.get_home_travel_fee($1) f`, [cityId])).rows[0].f);
  const total = Number(svc.price) + fee;

  // 6. booking (create_home_booking_atomic, the only insert path)
  const id = (await db!.query(
    `SELECT public.create_home_booking_atomic($1,$2,$3,$4,$5,$6,
       $7,$8,$9,NULL,$10,NULL,NULL,NULL,NULL,NULL,true,'paid',$11,$12,NULL,NULL) id`,
    [serviceId, DATE, chosen, "kunde@example.com", cityId, DE,
     "Musterstr", "12", "50667", "Max Mustermann", opts.session, total],
  )).rows[0].id as string;

  // 7. confirmation — the row the confirmation page and emails read back
  const row = (await db!.query(
    `SELECT therapist_id, status, payment_status, total_amount,
            to_char(booking_time,'HH24:MI') t, home_postal_code, home_city_id
       FROM bookings WHERE id = $1`, [id])).rows[0];

  return { step: "confirmed", ok: true as const, id, chosen, offered, total, fee, row };
}

describe.skipIf(db === null)("Home Visit funnel — healthy data, every city", () => {
  for (const [name, cityId] of Object.entries(CITY)) {
    it(`completes end to end in ${name}`, async () => {
      await db!.exec(`DELETE FROM bookings;`);
      const r = await bookHomeVisit(cityId, S50, { session: `sess-${name}` });

      expect(r.step).toBe("confirmed");
      if (!r.ok) return;
      expect(r.row.status).toBe("confirmed");
      expect(r.row.payment_status).toBe("paid");
      expect(r.row.therapist_id).toBeTruthy(); // a therapist was actually assigned
      expect(r.row.home_postal_code).toBe("50667");
      expect(r.row.home_city_id).toBe(cityId);
      expect(r.row.t).toBe(r.chosen);
    });
  }

  it("charges base price plus the city/country travel fee", async () => {
    await db!.exec(`DELETE FROM bookings;`);
    // Koeln inherits the country fee (12); Duesseldorf overrides it (25).
    const k = await bookHomeVisit(CITY.koeln, S50, { session: "fee-k" });
    await db!.exec(`DELETE FROM bookings;`);
    const d = await bookHomeVisit(CITY.duesseldorf, S50, { session: "fee-d" });

    expect(k.ok && d.ok).toBe(true);
    if (!k.ok || !d.ok) return;
    expect(k.fee).toBe(12);
    expect(d.fee).toBe(25);
    expect(k.total).toBe(55 + 12);
    expect(d.total).toBe(55 + 25);
    expect(Number(k.row.total_amount)).toBe(67);
  });

  it("a 90-minute visit is offered fewer slots than a 50-minute one", async () => {
    await db!.exec(`DELETE FROM bookings;`);
    const short = await bookHomeVisit(CITY.koeln, S50, { session: "dur-50" });
    await db!.exec(`DELETE FROM bookings;`);
    const long = await bookHomeVisit(CITY.koeln, S90, { session: "dur-90" });
    expect(short.ok && long.ok).toBe(true);
    if (!short.ok || !long.ok) return;
    // 09:00-18:00 fits a 50-min visit up to 17:00, a 90-min only up to 16:00.
    expect(long.offered.length).toBeLessThan(short.offered.length);
  });

  it("a second customer cannot take a slot that overlaps the first booking", async () => {
    await db!.exec(`DELETE FROM bookings;`);
    const first = await bookHomeVisit(CITY.koeln, S90, { session: "ov-1" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    // Koeln has a single therapist, now busy 09:00-10:30 (+5 min buffer).
    expect(await (async () =>
      (await db!.query(`SELECT public.check_home_slot_availability($1,$2,$3,$4) ok`,
        [CITY.koeln, DATE, "10:00", 50])).rows[0].ok)()).toBe(false);
    // ...and the slot after the buffer is still sellable.
    expect(await (async () =>
      (await db!.query(`SELECT public.check_home_slot_availability($1,$2,$3,$4) ok`,
        [CITY.koeln, DATE, "11:00", 50])).rows[0].ok)()).toBe(true);
  });
});

describe.skipIf(db === null)("Home Visit funnel — the production data state", () => {
  it("reports no availability at the DATE step instead of dead-ending at payment", async () => {
    // Reproduce what is live: an active schedule row whose window cannot hold
    // anything (start_time >= end_time). start/end are NOT NULL in production,
    // so this — not a NULL — is the degenerate case.
    await db!.exec(`DELETE FROM bookings;
      UPDATE therapist_weekly_schedules
         SET start_time='00:00', end_time='00:00'
       WHERE therapist_id='${THERAPIST.koeln}';`);

    const r = await bookHomeVisit(CITY.koeln, S50, { session: "dead-1" });

    // The customer is stopped at the date picker, having entered nothing.
    expect(r.ok).toBe(false);
    expect(r.step).toBe("date");

    // And the old behaviour is gone: no date is advertised for that pool.
    const dates = (await db!.query(
      `SELECT count(*)::int n FROM public.get_home_available_dates($1,$2,1,50)`,
      [CITY.koeln, DATE],
    )).rows[0].n;
    expect(dates).toBe(0);

    await db!.exec(`UPDATE therapist_weekly_schedules
        SET start_time='09:00', end_time='18:00'
      WHERE therapist_id='${THERAPIST.koeln}';`);
  });

  it("an inverted window is treated the same way", async () => {
    await db!.exec(`UPDATE therapist_weekly_schedules
        SET start_time='21:00', end_time='02:00'
      WHERE therapist_id='${THERAPIST.koeln}';`);
    const n = (await db!.query(
      `SELECT count(*)::int n FROM public.get_home_available_dates($1,$2,1,50)`,
      [CITY.koeln, DATE],
    )).rows[0].n;
    expect(n).toBe(0);
    await db!.exec(`UPDATE therapist_weekly_schedules
        SET start_time='09:00', end_time='18:00'
      WHERE therapist_id='${THERAPIST.koeln}';`);
  });

  it("one healthy city still sells while another is misconfigured", async () => {
    await db!.exec(`DELETE FROM bookings;
      UPDATE therapist_weekly_schedules SET start_time='00:00', end_time='00:00'
       WHERE therapist_id='${THERAPIST.koeln}';`);

    expect((await bookHomeVisit(CITY.koeln, S50, { session: "mix-k" })).ok).toBe(false);
    expect((await bookHomeVisit(CITY.duesseldorf, S50, { session: "mix-d" })).ok).toBe(true);

    await db!.exec(`UPDATE therapist_weekly_schedules
        SET start_time='09:00', end_time='18:00'
      WHERE therapist_id='${THERAPIST.koeln}';`);
  });
});
