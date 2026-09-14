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

GRANT EXECUTE ON FUNCTION public.get_home_available_dates(uuid, date, integer, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_home_available_dates(uuid, date, integer, integer) IS
  'Returns home-visit dates that can fit the selected service duration for an available therapist assigned to the city.';