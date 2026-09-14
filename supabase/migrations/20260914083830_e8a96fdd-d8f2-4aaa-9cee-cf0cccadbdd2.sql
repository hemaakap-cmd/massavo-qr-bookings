DROP FUNCTION IF EXISTS public.get_home_booked_slots(uuid, date);
DROP FUNCTION IF EXISTS public.get_home_booked_slots(uuid, date, integer);

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
  WITH pool AS (
    SELECT tc.therapist_id FROM public.therapist_cities tc WHERE tc.city_id = p_city_id
  ),
  pool_size AS (SELECT COUNT(*) AS n FROM pool),
  bk AS (
    SELECT b.therapist_id,
           b.booking_time AS st,
           (b.booking_time + make_interval(mins => COALESCE(s.duration_minutes, 60) + 5)) AS en,
           COALESCE(b.home_city_id, g.city_id, h.city_id) AS city_id
    FROM public.bookings b
    LEFT JOIN public.services s ON s.id = b.service_id
    LEFT JOIN public.gyms g ON g.id = b.gym_id
    LEFT JOIN public.hotels h ON h.id = b.hotel_id
    WHERE b.booking_date = p_date
      AND b.therapist_id IN (SELECT therapist_id FROM pool)
      AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
  ),
  slots AS (
    SELECT to_char(t, 'HH24:MI') AS slot, t::time AS st
    FROM generate_series(timestamp '2000-01-01 08:00', timestamp '2000-01-01 22:00', interval '30 minutes') AS t
  ),
  avail AS (
    SELECT sl.slot, COUNT(*) FILTER (WHERE x.free) AS free_count
    FROM slots sl
    CROSS JOIN LATERAL (
      SELECT NOT EXISTS (
        SELECT 1 FROM bk
        WHERE bk.therapist_id = p.therapist_id
          AND (
            -- same therapist already busy in an overlapping window
            (sl.st, sl.st + make_interval(mins => COALESCE(p_duration_minutes, 60) + 5)) OVERLAPS (bk.st, bk.en)
            -- or already working in a different city that day
            OR bk.city_id IS DISTINCT FROM p_city_id
          )
      ) AS free
      FROM pool p
    ) x
    GROUP BY sl.slot
  )
  SELECT a.slot FROM avail a, pool_size ps WHERE ps.n > 0 AND a.free_count = 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_booked_slots(uuid, date, integer) TO anon, authenticated, service_role;