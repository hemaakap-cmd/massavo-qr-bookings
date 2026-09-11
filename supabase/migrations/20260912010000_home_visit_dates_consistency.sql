-- =====================================================================
-- HOME VISIT — stop offering dates that have no bookable slot.
--
-- FOUND LIVE (anon, read-only, 2026-09-12)
-- ----------------------------------------
--   get_home_available_dates('Köln', …)      -> 2026-09-14, 09-15, 09-16, …
--   check_home_slot_availability(…, every
--     half-hour slot from 00:00 to 23:30)    -> false, all 48 of them
--   get_home_booked_slots('Köln', …)         -> []   (nothing greyed out)
--
-- So the date picker offers dates, the slot grid renders every time as
-- clickable, and the customer fills in the whole form — then create-payment
-- calls check_home_slot_availability, gets false, and returns 409. Every
-- home-visit attempt dies at the payment step. The funnel is 100% dead.
--
-- WHY THE TWO FUNCTIONS DISAGREE
-- ------------------------------
-- get_home_available_dates only asks "does an active weekly schedule row
-- exist for this weekday?". It never looks at start_time/end_time.
-- check_home_slot_availability additionally requires
--     p_time >= ws.start_time AND p_time < ws.end_time
-- A row whose window is degenerate — NULL times, zero-length, or inverted —
-- satisfies the first test and can never satisfy the second. That is exactly
-- the observed signature: dates offered, not one slot bookable all day.
--
-- Note this is NOT "the hardcoded 09:00–19:00 grid misses their shift". A
-- full 00:00–23:30 sweep found no bookable time at all, so no grid could
-- have matched.
--
-- WHAT THIS CHANGES
-- -----------------
-- A date is offered only when some therapist in the pool has a usable
-- window that day: both bounds present, start before end, and long enough
-- to hold a session. That is the same rule check_home_slot_availability
-- already enforces per-slot, so this removes a contradiction between two
-- functions rather than introducing a new rule.
--
-- Effect on the observed data: Köln stops offering dates it cannot honour,
-- and the customer is told "no availability" up front instead of being sent
-- to a 409 after filling in their address and health details.
--
-- THIS DOES NOT REPAIR THE UNDERLYING SCHEDULE ROWS. If the pool's working
-- hours are genuinely missing, home visits will correctly show no
-- availability until an admin sets real hours on therapist_weekly_schedules.
-- That is a data fix and a business decision, not something a migration
-- should invent.
--
-- Return shape is unchanged, so useHomeAvailableDates keeps working.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_home_available_dates(
  p_city_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_months_ahead integer DEFAULT 3,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(available_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT gs::date AS d
    FROM generate_series(
      p_start_date,
      (p_start_date + make_interval(months => p_months_ahead)),
      interval '1 day'
    ) gs
  )
  SELECT DISTINCT d AS available_date
  FROM days
  WHERE EXISTS (
    SELECT 1
    FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws
      ON ws.therapist_id = tc.therapist_id
    WHERE tc.city_id = p_city_id
      AND ws.is_active
      AND ws.day_of_week = public.dow_enum(d)
      -- The window must actually be able to hold a session. Without this a
      -- NULL / zero-length / inverted window still advertises the date while
      -- every slot on it fails the per-slot check.
      AND ws.start_time IS NOT NULL
      AND ws.end_time   IS NOT NULL
      AND (EXTRACT(EPOCH FROM ws.start_time) / 60)::int
            + COALESCE(p_duration_minutes, 60)
          <= (EXTRACT(EPOCH FROM ws.end_time) / 60)::int
      AND NOT EXISTS (
        SELECT 1 FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id
          AND tl.status = 'approved'
          AND d BETWEEN tl.start_date AND tl.end_date
      )
  )
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_home_available_dates IS
  'Dates on which the city pool can actually serve a home visit. Requires a usable working window, matching the per-slot rule in check_home_slot_availability, so the date picker cannot offer a day on which nothing is bookable.';

-- The three-argument calls the frontend already makes stay valid via the
-- new parameter default; drop the old arity so those calls are unambiguous.
DROP FUNCTION IF EXISTS public.get_home_available_dates(uuid, date, integer);

GRANT EXECUTE ON FUNCTION public.get_home_available_dates(uuid, date, integer, integer) TO anon, authenticated;
