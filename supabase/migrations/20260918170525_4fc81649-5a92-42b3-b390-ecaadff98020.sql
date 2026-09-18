-- =====================================================================
-- HOME VISIT — duration- and buffer-aware availability.
-- =====================================================================

-- 1) Shared predicate ---------------------------------------------------
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
  CROSS JOIN slot
  WHERE tc.city_id = p_city_id
    AND ws.is_active
    -- The session must start within the shift AND finish before it ends.
    AND slot.slot_start  >= (EXTRACT(EPOCH FROM ws.start_time) / 60)::int
    AND slot.service_end <= (EXTRACT(EPOCH FROM ws.end_time)   / 60)::int
    AND NOT EXISTS (
      SELECT 1 FROM public.therapist_leaves tl
      WHERE tl.therapist_id = tc.therapist_id
        AND tl.status = 'approved'
        AND p_date BETWEEN tl.start_date AND tl.end_date
    )
    -- Duration-aware conflict: any existing booking whose reserved window
    -- overlaps this slot's reserved window disqualifies the therapist.
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

COMMENT ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer) IS
  'Single source of truth for home-visit slot availability. Duration- and buffer-aware; mirrors src/utils/timeSlotCalculator.ts. Used by check_home_slot_availability, get_home_booked_slots and create_home_booking_atomic so they cannot drift.';

-- 2) Availability check -------------------------------------------------
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
    SELECT 1 FROM public.home_free_therapists(
      p_city_id, p_date, p_time::time, COALESCE(p_duration_minutes, 60)
    )
  );
$$;

-- 3) Booked-slot hints for the picker ----------------------------------
DROP FUNCTION IF EXISTS public.get_home_booked_slots(uuid, date);

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
    WHERE tc.city_id = p_city_id
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

-- 4) Atomic creation ----------------------------------------------------
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
  v_duration integer;
BEGIN
  -- Idempotency: same Stripe session already produced a booking.
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT id INTO v_booking_id FROM public.bookings
     WHERE stripe_session_id = p_stripe_session_id LIMIT 1;
    IF v_booking_id IS NOT NULL THEN
      RETURN v_booking_id;
    END IF;
  END IF;

  -- Duration comes from the service, never from the caller.
  SELECT COALESCE(duration_minutes, 60) INTO v_duration
  FROM public.services WHERE id = p_service_id;
  v_duration := COALESCE(v_duration, 60);

  -- Serialise the whole (city, date) pool.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_home_city_id::text || ':' || p_booking_date::text, 0)
  );

  SELECT ft.therapist_id INTO v_therapist
  FROM public.home_free_therapists(
    p_home_city_id, p_booking_date, p_booking_time::time, v_duration
  ) ft
  ORDER BY ft.therapist_id
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
    p_service_id, p_booking_date, p_booking_time::time, p_customer_email,
    p_home_city_id, p_home_country_id, p_home_street, p_home_house_no,
    p_home_postal_code, p_home_address_notes,
    p_customer_name, p_client_phone, p_client_age, NULLIF(p_date_of_birth, '')::date,
    p_salutation, p_gender, p_health_confirmed,
    v_therapist, 'confirmed', p_payment_status, p_stripe_session_id,
    p_total_amount, p_cancellation_token, p_user_id
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- 5) Grants — unchanged from the previous migration ---------------------
REVOKE EXECUTE ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_home_booked_slots(uuid, date, integer)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_home_slot_availability(uuid, date, text, integer)  TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_home_booking_atomic FROM anon, authenticated;