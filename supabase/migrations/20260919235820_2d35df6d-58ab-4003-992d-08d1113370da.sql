
-- ─────────────────────────────────────────────────────────────
-- Dynamic availability engine (server side)
-- Occupied time = prep(5) + duration + after(5) [+ 30 travel for home]
-- ─────────────────────────────────────────────────────────────

-- 1) Home: shared predicate now buffer-before aware and travel-aware.
DROP FUNCTION IF EXISTS public.home_free_therapists(uuid, date, time, integer, integer);

CREATE OR REPLACE FUNCTION public.home_free_therapists(
  p_city_id uuid,
  p_date date,
  p_time time,
  p_duration_minutes integer DEFAULT 60,
  p_buffer_after_minutes integer DEFAULT 35,   -- 5 after-treatment + 30 travel
  p_buffer_before_minutes integer DEFAULT 5    -- preparation time
)
RETURNS TABLE(therapist_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH slot AS (
    SELECT
      (EXTRACT(EPOCH FROM p_time) / 60)::int                                   AS slot_start,
      (EXTRACT(EPOCH FROM p_time) / 60)::int
        - GREATEST(COALESCE(p_buffer_before_minutes, 0), 0)                     AS reserved_start,
      (EXTRACT(EPOCH FROM p_time) / 60)::int + p_duration_minutes              AS service_end,
      (EXTRACT(EPOCH FROM p_time) / 60)::int + p_duration_minutes
        + GREATEST(COALESCE(p_buffer_after_minutes, 0), 0)                      AS reserved_end
  )
  SELECT tc.therapist_id
  FROM public.therapist_cities tc
  JOIN public.therapist_weekly_schedules ws
    ON ws.therapist_id = tc.therapist_id
   AND ws.day_of_week = public.dow_enum(p_date)
   AND ws.gym_id IS NULL
   AND ws.hotel_id IS NULL
   AND (ws.city_id IS NULL OR ws.city_id = tc.city_id)
  CROSS JOIN slot
  WHERE tc.city_id = p_city_id
    AND ws.is_active
    -- Preparation must fit at the start, the session must finish before shift end.
    AND slot.reserved_start >= (EXTRACT(EPOCH FROM ws.start_time) / 60)::int
    AND slot.service_end    <= (EXTRACT(EPOCH FROM ws.end_time)   / 60)::int
    AND NOT EXISTS (
      SELECT 1 FROM public.therapist_leaves tl
      WHERE tl.therapist_id = tc.therapist_id
        AND tl.status = 'approved'
        AND p_date BETWEEN tl.start_date AND tl.end_date
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.bookings b
      LEFT JOIN public.services s ON s.id = b.service_id
      WHERE b.therapist_id = tc.therapist_id
        AND b.booking_date = p_date
        AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
        AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int
              - GREATEST(COALESCE(p_buffer_before_minutes, 0), 0) < slot.reserved_end
        AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int
              + COALESCE(s.duration_minutes, 60)
              + GREATEST(COALESCE(p_buffer_after_minutes, 0), 0) > slot.reserved_start
    )
  GROUP BY tc.therapist_id;
$$;

COMMENT ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer, integer) IS
  'Single source of truth for home-visit availability: occupied = 5 prep + duration + 5 after + 30 fixed travel.';

REVOKE EXECUTE ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer, integer) TO service_role;

-- 2) Home: dynamic bookable start times (no hardcoded grid).
CREATE OR REPLACE FUNCTION public.get_home_available_slots(
  p_city_id uuid,
  p_date date,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(slot_time text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (
    SELECT COALESCE(p_duration_minutes, 60) AS dur
  ),
  occ AS (
    SELECT dur, 5 + dur + 5 + 30 AS occupied FROM d
  ),
  shifts AS (
    SELECT
      MIN((EXTRACT(EPOCH FROM ws.start_time) / 60)::int) AS min_start,
      MAX((EXTRACT(EPOCH FROM ws.end_time)   / 60)::int) AS max_end
    FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws
      ON ws.therapist_id = tc.therapist_id
     AND ws.day_of_week = public.dow_enum(p_date)
     AND ws.gym_id IS NULL
     AND ws.hotel_id IS NULL
     AND (ws.city_id IS NULL OR ws.city_id = tc.city_id)
    WHERE tc.city_id = p_city_id
      AND ws.is_active
  ),
  grid AS (
    SELECT g AS start_min
    FROM shifts, occ,
         generate_series(shifts.min_start + 5, GREATEST(shifts.max_end, shifts.min_start), occ.occupied) AS g
    WHERE shifts.min_start IS NOT NULL
  )
  SELECT to_char(make_time(grid.start_min / 60, grid.start_min % 60, 0), 'HH24:MI')
  FROM grid, occ, shifts
  WHERE grid.start_min + occ.dur <= shifts.max_end
    AND EXISTS (
      SELECT 1 FROM public.home_free_therapists(
        p_city_id, p_date,
        make_time(grid.start_min / 60, grid.start_min % 60, 0),
        occ.dur
      )
    )
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.get_home_available_slots(uuid, date, integer) IS
  'Dynamic home-visit start times for a city/date: spacing = 5 + duration + 5 + 30, filtered by therapist shifts and existing bookings.';

GRANT EXECUTE ON FUNCTION public.get_home_available_slots(uuid, date, integer) TO anon, authenticated, service_role;

-- 3) Gym: prep-time and overlap aware validation.
CREATE OR REPLACE FUNCTION public.check_slot_availability(
  p_gym_id uuid,
  p_date date,
  p_time time without time zone,
  p_duration_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule_rec RECORD;
  v_break_duration INTEGER;
  v_schedule_start_min INTEGER;
  v_schedule_end_min INTEGER;
  v_actual_hours NUMERIC;
  v_midpoint INTEGER;
  v_break_start_min INTEGER;
  v_break_end_min INTEGER;
  v_slot_start_min INTEGER;
  v_slot_end_min INTEGER;
BEGIN
  SELECT gs.* INTO schedule_rec
  FROM public.gym_schedules gs
  WHERE gs.gym_id = p_gym_id
    AND gs.is_active = true
    AND LOWER(TO_CHAR(p_date, 'day'))::text LIKE gs.day_of_week::text || '%';

  IF schedule_rec IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.schedule_exceptions se
    WHERE se.gym_id = p_gym_id AND se.exception_date = p_date AND se.is_disabled = true
  ) THEN RETURN false; END IF;

  v_schedule_start_min := EXTRACT(HOUR FROM schedule_rec.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_rec.start_time)::INTEGER;
  v_schedule_end_min := EXTRACT(HOUR FROM schedule_rec.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_rec.end_time)::INTEGER;
  v_slot_start_min := EXTRACT(HOUR FROM p_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_time)::INTEGER;
  v_slot_end_min := v_slot_start_min + p_duration_minutes;

  -- 5 min preparation must fit at the start, the session must end inside the shift.
  IF v_slot_start_min - 5 < v_schedule_start_min OR v_slot_end_min > v_schedule_end_min THEN
    RETURN false;
  END IF;

  v_actual_hours := (v_schedule_end_min - v_schedule_start_min)::NUMERIC / 60;
  IF v_actual_hours >= 8 THEN v_break_duration := 30;
  ELSIF v_actual_hours >= 6 THEN v_break_duration := 15;
  ELSE v_break_duration := 0; END IF;

  IF v_break_duration > 0 THEN
    v_midpoint := (v_schedule_start_min + v_schedule_end_min) / 2;
    v_break_start_min := v_midpoint - (v_break_duration / 2);
    v_break_end_min := v_break_start_min + v_break_duration;
    IF v_slot_start_min - 5 < v_break_end_min AND v_slot_end_min + 5 > v_break_start_min THEN
      RETURN false;
    END IF;
  END IF;

  -- Overlap with an existing booking or its buffers (5 before / 5 after).
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.services s ON s.id = b.service_id
    WHERE b.gym_id = p_gym_id
      AND b.booking_date = p_date
      AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
      AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int - 5 < v_slot_end_min + 5
      AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int
            + COALESCE(s.duration_minutes, 60) + 5 > v_slot_start_min - 5
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 4) Hotel: same rules.
CREATE OR REPLACE FUNCTION public.check_hotel_slot_availability(
  p_hotel_id uuid,
  p_date date,
  p_time time without time zone,
  p_duration_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  schedule_rec RECORD;
  v_break_duration INTEGER;
  v_schedule_start_min INTEGER;
  v_schedule_end_min INTEGER;
  v_actual_hours NUMERIC;
  v_midpoint INTEGER;
  v_break_start_min INTEGER;
  v_break_end_min INTEGER;
  v_slot_start_min INTEGER;
  v_slot_end_min INTEGER;
BEGIN
  SELECT hs.* INTO schedule_rec FROM public.hotel_schedules hs
  WHERE hs.hotel_id = p_hotel_id AND hs.is_active = true
    AND LOWER(TO_CHAR(p_date, 'day'))::text LIKE hs.day_of_week::text || '%';
  IF schedule_rec IS NULL THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.schedule_exceptions se
    WHERE se.hotel_id = p_hotel_id AND se.exception_date = p_date AND se.is_disabled = true) THEN
    RETURN false;
  END IF;

  v_schedule_start_min := EXTRACT(HOUR FROM schedule_rec.start_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_rec.start_time)::INTEGER;
  v_schedule_end_min := EXTRACT(HOUR FROM schedule_rec.end_time)::INTEGER * 60 + EXTRACT(MINUTE FROM schedule_rec.end_time)::INTEGER;
  v_slot_start_min := EXTRACT(HOUR FROM p_time)::INTEGER * 60 + EXTRACT(MINUTE FROM p_time)::INTEGER;
  v_slot_end_min := v_slot_start_min + p_duration_minutes;

  IF v_slot_start_min - 5 < v_schedule_start_min OR v_slot_end_min > v_schedule_end_min THEN
    RETURN false;
  END IF;

  v_actual_hours := (v_schedule_end_min - v_schedule_start_min)::NUMERIC / 60;
  IF v_actual_hours >= 8 THEN v_break_duration := 30;
  ELSIF v_actual_hours >= 6 THEN v_break_duration := 15;
  ELSE v_break_duration := 0; END IF;

  IF v_break_duration > 0 THEN
    v_midpoint := (v_schedule_start_min + v_schedule_end_min) / 2;
    v_break_start_min := v_midpoint - (v_break_duration / 2);
    v_break_end_min := v_break_start_min + v_break_duration;
    IF v_slot_start_min - 5 < v_break_end_min AND v_slot_end_min + 5 > v_break_start_min THEN
      RETURN false;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.services s ON s.id = b.service_id
    WHERE b.hotel_id = p_hotel_id
      AND b.booking_date = p_date
      AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
      AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int - 5 < v_slot_end_min + 5
      AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int
            + COALESCE(s.duration_minutes, 60) + 5 > v_slot_start_min - 5
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;
