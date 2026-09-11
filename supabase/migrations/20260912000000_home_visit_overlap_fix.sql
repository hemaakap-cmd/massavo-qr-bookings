-- =====================================================================
-- HOME VISIT — duration- and buffer-aware availability.
--
-- BUG BEING FIXED
-- ---------------
-- Every home-visit availability check compared only the *start* time:
--
--     to_char(b.booking_time, 'HH24:MI') = p_time
--
-- so a session's duration was invisible. A therapist booked 10:00 for a
-- 90-minute service (running to 11:30) was still reported free at 10:30
-- and 11:00, and `create_home_booking_atomic` would happily assign that
-- same therapist a second, overlapping visit.
--
-- `check_home_slot_availability` even accepted a `p_duration_minutes`
-- argument and never referenced it — and `create-payment` has always
-- passed the real service duration into it. The caller's intent was
-- correct; the function silently dropped it.
--
-- This is drift from the rule the rest of the platform already applies.
-- The gym/hotel path computes true reserved windows in
-- `src/utils/timeSlotCalculator.ts` (`calculateReservedWindows` /
-- `windowsOverlap`) using service duration plus the buffers defined in
-- `src/constants/booking.ts`, and `get_booked_slots` /
-- `get_hotel_booked_slots` return duration + buffers precisely so that
-- overlap can be computed. Home visits were the only venue type left
-- matching on a bare start time.
--
-- WHAT CHANGES
-- ------------
--  * One shared predicate, `home_free_therapists`, is now the single
--    source of truth for "who can take this slot". The availability
--    check and the atomic writer both call it, so they cannot drift
--    apart again — that divergence is what allowed the overlap.
--  * Overlap is computed on half-open reserved windows in minutes from
--    midnight, mirroring timeSlotCalculator.ts exactly:
--        booked  = [start, start + duration + buffer_after)
--        slot    = [start, start + duration + buffer_after)
--        overlap = booked.start < slot.end AND booked.end > slot.start
--  * The whole session must now fit inside the therapist's working
--    window (previously only the start time had to), matching the
--    frontend's `currentTime + serviceDurationMinutes <= scheduleEnd`.
--  * The advisory lock in the atomic writer is keyed on (city, date)
--    rather than (city, date, time). Two overlapping bookings at
--    *different* start times took different locks, so serialisation
--    never applied to the case that actually overlaps.
--
-- NO BUSINESS RULE IS INVENTED HERE. The buffer default (5 minutes
-- after a session, 0 before) is the existing DEFAULT_BUFFER_AFTER /
-- DEFAULT_BUFFER_BEFORE from src/constants/booking.ts; neither
-- `bookings` nor `services` carries a per-row buffer column today, so
-- those defaults are already the effective values. It is exposed as a
-- parameter so it stays tunable from one place.
--
-- Signatures are unchanged for every existing caller: the new duration
-- argument is optional and defaults to the previous implicit 60.
-- =====================================================================

-- 1) Shared predicate ---------------------------------------------------
-- Therapists in a city pool who are free for [p_time, +duration+buffer).
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

COMMENT ON FUNCTION public.home_free_therapists IS
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
-- Same return contract as before (slot_time text), but a slot is now
-- reported blocked when no therapist can serve a session of
-- p_duration_minutes starting there — covering overlap with longer
-- sessions and slots that run past the end of a shift.
--
-- The old two-argument version must be dropped rather than replaced:
-- keeping it alongside a three-argument version with a defaulted third
-- parameter would make every existing two-argument call ambiguous
-- ("function is not unique"). Callers that pass two arguments continue
-- to work against the new definition via the default.
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

  -- Serialise the whole (city, date) pool. Keying the lock on the start
  -- time as well meant two *overlapping* bookings at different start
  -- times never contended, which is exactly the race that produced
  -- double-booked therapists.
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
-- home_free_therapists is an internal predicate: it exposes therapist ids,
-- so it is NOT granted to anon/authenticated. The public surface stays the
-- two aggregate helpers, which leak no identities.
REVOKE EXECUTE ON FUNCTION public.home_free_therapists(uuid, date, time, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_home_booked_slots(uuid, date, integer)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_home_slot_availability(uuid, date, text, integer)  TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_home_booking_atomic FROM anon, authenticated;
