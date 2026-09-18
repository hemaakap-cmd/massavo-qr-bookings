ALTER TABLE public.therapist_weekly_schedules
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tws_home_city
  ON public.therapist_weekly_schedules (city_id)
  WHERE gym_id IS NULL AND hotel_id IS NULL;

-- Shared availability predicate: home shifts only, scoped to the city.
CREATE OR REPLACE FUNCTION public.home_free_therapists(
  p_city_id uuid,
  p_date date,
  p_time time,
  p_duration_minutes integer DEFAULT 60,
  p_buffer_after_minutes integer DEFAULT 5
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
      (EXTRACT(EPOCH FROM p_time) / 60)::int + p_duration_minutes              AS service_end,
      (EXTRACT(EPOCH FROM p_time) / 60)::int + p_duration_minutes
        + GREATEST(p_buffer_after_minutes, 0)                                  AS reserved_end
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
    AND slot.slot_start  >= (EXTRACT(EPOCH FROM ws.start_time) / 60)::int
    AND slot.service_end <= (EXTRACT(EPOCH FROM ws.end_time)   / 60)::int
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
        AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int < slot.reserved_end
        AND (EXTRACT(EPOCH FROM b.booking_time) / 60)::int
              + COALESCE(s.duration_minutes, 60)
              + GREATEST(p_buffer_after_minutes, 0) > slot.slot_start
    )
  GROUP BY tc.therapist_id;
$$;

-- Available dates (duration-aware overload)
CREATE OR REPLACE FUNCTION public.get_home_available_dates(
  p_city_id uuid,
  p_start_date date,
  p_months_ahead integer,
  p_duration_minutes integer
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
     AND ws.gym_id IS NULL
     AND ws.hotel_id IS NULL
     AND (ws.city_id IS NULL OR ws.city_id = tc.city_id)
    JOIN public.therapists t
      ON t.id = tc.therapist_id
    WHERE tc.city_id = p_city_id
      AND t.is_available = true
      AND ws.is_active
      AND ws.day_of_week = public.dow_enum(d)
      AND ws.start_time IS NOT NULL
      AND ws.end_time IS NOT NULL
      AND (EXTRACT(EPOCH FROM ws.start_time) / 60)::int
            + COALESCE(p_duration_minutes, 60)
          <= (EXTRACT(EPOCH FROM ws.end_time) / 60)::int
      AND NOT EXISTS (
        SELECT 1
        FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id
          AND tl.status = 'approved'
          AND d BETWEEN tl.start_date AND tl.end_date
      )
  )
  ORDER BY 1;
$$;

-- Available dates (legacy overload)
CREATE OR REPLACE FUNCTION public.get_home_available_dates(
  p_city_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_months_ahead integer DEFAULT 3
)
RETURNS TABLE(available_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT available_date
  FROM public.get_home_available_dates(p_city_id, p_start_date, p_months_ahead, 60);
$$;

-- Booked-slot hints: pool must be therapists with a home shift in this city.
CREATE OR REPLACE FUNCTION public.get_home_booked_slots(
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
  WITH grid AS (
    SELECT to_char(make_time(h, m, 0), 'HH24:MI') AS t,
           make_time(h, m, 0)                     AS tt
    FROM generate_series(0, 23) h
    CROSS JOIN (VALUES (0), (30)) AS mins(m)
  ),
  pool AS (
    SELECT COUNT(*) AS n
    FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws
      ON ws.therapist_id = tc.therapist_id
     AND ws.gym_id IS NULL
     AND ws.hotel_id IS NULL
     AND (ws.city_id IS NULL OR ws.city_id = tc.city_id)
    WHERE tc.city_id = p_city_id
      AND ws.is_active
  )
  SELECT grid.t
  FROM grid, pool
  WHERE pool.n > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.home_free_therapists(
        p_city_id, p_date, grid.tt, COALESCE(p_duration_minutes, 60)
      )
    )
  ORDER BY 1;
$$;

REVOKE EXECUTE ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_booked_slots(uuid, date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_available_dates(uuid, date, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_available_dates(uuid, date, integer) TO anon, authenticated;