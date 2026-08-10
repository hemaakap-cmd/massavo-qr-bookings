-- =====================================================================
-- HOME VISIT — native extension of the existing Massavo booking model.
--
-- Design (see implementation report):
--   * 'home' becomes a first-class venue_type_enum value.
--   * A home booking is a normal `bookings` row with gym_id = hotel_id = NULL
--     and the home_* destination columns populated.
--   * Availability + assignment come from the existing therapist model:
--     therapists mapped to a city (therapist_cities) whose weekly schedule
--     (therapist_weekly_schedules) covers the slot and who are not on leave
--     (therapist_leaves) and not already booked (any venue).
--   * Pricing is server-authoritative: base service price + a flat travel fee
--     resolved city -> country. The client never supplies a price.
--
-- NOTHING here weakens existing RLS. Home addresses live inside `bookings`,
-- which is already anon-denied, so they are never exposed via public catalog
-- APIs. Existing gym/hotel behaviour is untouched.
--
-- Apply order note: ALTER TYPE ... ADD VALUE cannot run inside the same
-- transaction that later uses the new value, so the enum change is committed
-- first, then the rest follows.
-- =====================================================================

-- 1) New venue type -----------------------------------------------------
ALTER TYPE public.venue_type_enum ADD VALUE IF NOT EXISTS 'home';

COMMIT;

-- 2) Home destination columns on bookings ------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS home_street        text,
  ADD COLUMN IF NOT EXISTS home_house_no      text,
  ADD COLUMN IF NOT EXISTS home_postal_code   text,
  ADD COLUMN IF NOT EXISTS home_city_id       uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS home_country_id    uuid REFERENCES public.countries(id),
  ADD COLUMN IF NOT EXISTS home_address_notes text;

COMMENT ON COLUMN public.bookings.home_city_id IS
  'Set only for home-visit bookings (gym_id and hotel_id both NULL). Sensitive: inherits bookings RLS, never public.';

-- 3) Per-service opt-in for home visits --------------------------------
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS home_visit_enabled boolean NOT NULL DEFAULT false;

-- 4) Server-authoritative travel fee -----------------------------------
--    Country-level default, optional per-city override (NULL = inherit country).
ALTER TABLE public.country_financials
  ADD COLUMN IF NOT EXISTS home_visit_travel_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS home_visit_travel_fee numeric;

-- Resolve the effective travel fee for a city (city override -> country default).
CREATE OR REPLACE FUNCTION public.get_home_travel_fee(_city_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    c.home_visit_travel_fee,
    (SELECT cf.home_visit_travel_fee
       FROM public.country_financials cf
      WHERE cf.country_id = c.country_id
      LIMIT 1),
    0
  )
  FROM public.cities c
  WHERE c.id = _city_id;
$$;

-- 5) Availability — therapists mapped to the city --------------------------
-- Returns the set of dates in the window where at least one therapist assigned
-- to the city has a weekly schedule for that weekday and is not on leave.
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
      AND ws.day_of_week = EXTRACT(DOW FROM d)::int
      AND NOT EXISTS (
        SELECT 1 FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id
          AND d BETWEEN tl.start_date AND tl.end_date
      )
  )
  ORDER BY 1;
$$;

-- Booked slots for the city pool: a time is "booked out" only when EVERY
-- therapist serving the city is busy at that time.
CREATE OR REPLACE FUNCTION public.get_home_booked_slots(
  p_city_id uuid,
  p_date date
)
RETURNS TABLE(slot_time text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pool AS (
    SELECT tc.therapist_id
    FROM public.therapist_cities tc
    WHERE tc.city_id = p_city_id
  ),
  pool_size AS (SELECT COUNT(*) n FROM pool),
  busy AS (
    SELECT to_char(b.booking_time, 'HH24:MI') AS t, COUNT(DISTINCT b.therapist_id) AS busy_count
    FROM public.bookings b
    WHERE b.booking_date = p_date
      AND b.therapist_id IN (SELECT therapist_id FROM pool)
      AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
    GROUP BY 1
  )
  SELECT busy.t
  FROM busy, pool_size
  WHERE pool_size.n > 0 AND busy.busy_count >= pool_size.n;
$$;

-- Is a specific slot bookable (at least one therapist in the pool is free)?
CREATE OR REPLACE FUNCTION public.check_home_slot_availability(
  p_city_id uuid,
  p_date date,
  p_time text,
  p_duration_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_cities tc
    JOIN public.therapist_weekly_schedules ws
      ON ws.therapist_id = tc.therapist_id
     AND ws.day_of_week = EXTRACT(DOW FROM p_date)::int
    WHERE tc.city_id = p_city_id
      AND (p_time::time) >= ws.start_time
      AND (p_time::time) <  ws.end_time
      AND NOT EXISTS (
        SELECT 1 FROM public.therapist_leaves tl
        WHERE tl.therapist_id = tc.therapist_id
          AND p_date BETWEEN tl.start_date AND tl.end_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.therapist_id = tc.therapist_id
          AND b.booking_date = p_date
          AND to_char(b.booking_time, 'HH24:MI') = p_time
          AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
      )
  );
$$;

-- 6) Atomic home booking creation + auto-assignment --------------------
-- Picks the first free therapist in the city pool and inserts the booking
-- under a row lock, so two concurrent requests cannot grab the same
-- therapist/slot. Raises SLOT_UNAVAILABLE when nobody is free.
CREATE OR REPLACE FUNCTION public.create_home_booking_atomic(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time text,
  p_customer_email text,
  p_home_city_id uuid,
  p_home_country_id uuid,
  p_home_street text DEFAULT NULL,
  p_home_house_no text DEFAULT NULL,
  p_home_postal_code text DEFAULT NULL,
  p_home_address_notes text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_client_phone text DEFAULT NULL,
  p_client_age integer DEFAULT NULL,
  p_date_of_birth text DEFAULT NULL,
  p_salutation text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_health_confirmed boolean DEFAULT NULL,
  p_payment_status text DEFAULT 'paid',
  p_stripe_session_id text DEFAULT NULL,
  p_total_amount numeric DEFAULT NULL,
  p_cancellation_token text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_therapist uuid;
  v_booking_id uuid;
  v_dow int := EXTRACT(DOW FROM p_booking_date)::int;
BEGIN
  -- Idempotency: same Stripe session already produced a booking.
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_booking_id FROM public.bookings
     WHERE stripe_session_id = p_stripe_session_id LIMIT 1;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  -- Pick a free therapist in the city pool, locking their conflicting rows.
  SELECT tc.therapist_id INTO v_therapist
  FROM public.therapist_cities tc
  JOIN public.therapist_weekly_schedules ws
    ON ws.therapist_id = tc.therapist_id
   AND ws.day_of_week = v_dow
  WHERE tc.city_id = p_home_city_id
    AND (p_booking_time::time) >= ws.start_time
    AND (p_booking_time::time) <  ws.end_time
    AND NOT EXISTS (
      SELECT 1 FROM public.therapist_leaves tl
      WHERE tl.therapist_id = tc.therapist_id
        AND p_booking_date BETWEEN tl.start_date AND tl.end_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.therapist_id = tc.therapist_id
        AND b.booking_date = p_booking_date
        AND to_char(b.booking_time, 'HH24:MI') = p_booking_time
        AND COALESCE(b.status, '') NOT IN ('cancelled', 'rescheduled')
    )
  ORDER BY tc.therapist_id
  FOR UPDATE OF ws
  LIMIT 1;

  IF v_therapist IS NULL THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE';
  END IF;

  INSERT INTO public.bookings (
    service_id, booking_date, booking_time, customer_email,
    home_city_id, home_country_id, home_street, home_house_no,
    home_postal_code, home_address_notes,
    customer_name, client_phone, client_age, date_of_birth,
    salutation, gender, health_confirmed,
    therapist_id, status, payment_status, stripe_session_id,
    total_amount, cancellation_token, user_id
  ) VALUES (
    p_service_id, p_booking_date, p_booking_time, p_customer_email,
    p_home_city_id, p_home_country_id, p_home_street, p_home_house_no,
    p_home_postal_code, p_home_address_notes,
    p_customer_name, p_client_phone, p_client_age, p_date_of_birth,
    p_salutation, p_gender, p_health_confirmed,
    v_therapist, 'confirmed', p_payment_status, p_stripe_session_id,
    p_total_amount, p_cancellation_token, p_user_id
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- 7) Grants — anon/auth may READ availability (safe, non-sensitive),
--    booking creation stays server-role only (called by edge functions).
GRANT EXECUTE ON FUNCTION public.get_home_travel_fee(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_available_dates(uuid, date, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_booked_slots(uuid, date)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_home_slot_availability(uuid, date, text, integer) TO anon, authenticated;
-- create_home_booking_atomic intentionally NOT granted to anon: it is invoked
-- with the service role from verify-payment after a confirmed Stripe payment.
REVOKE EXECUTE ON FUNCTION public.create_home_booking_atomic FROM anon, authenticated;
