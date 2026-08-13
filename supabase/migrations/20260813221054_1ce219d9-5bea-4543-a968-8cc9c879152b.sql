CREATE OR REPLACE FUNCTION public.enforce_therapist_booking_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / internal calls and admins are unrestricted
  IF auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin (therapist) callers may not touch financial / identity columns
  IF NEW.total_amount    IS DISTINCT FROM OLD.total_amount
     OR NEW.payment_status     IS DISTINCT FROM OLD.payment_status
     OR NEW.invoice_number     IS DISTINCT FROM OLD.invoice_number
     OR NEW.stripe_session_id  IS DISTINCT FROM OLD.stripe_session_id
     OR NEW.customer_email     IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_name      IS DISTINCT FROM OLD.customer_name
     OR NEW.client_phone       IS DISTINCT FROM OLD.client_phone
     OR NEW.client_address     IS DISTINCT FROM OLD.client_address
     OR NEW.date_of_birth      IS DISTINCT FROM OLD.date_of_birth
     OR NEW.health_confirmed   IS DISTINCT FROM OLD.health_confirmed
     OR NEW.cancellation_token IS DISTINCT FROM OLD.cancellation_token
     OR NEW.user_id            IS DISTINCT FROM OLD.user_id
     OR NEW.gym_id             IS DISTINCT FROM OLD.gym_id
     OR NEW.hotel_id           IS DISTINCT FROM OLD.hotel_id
     OR NEW.service_id         IS DISTINCT FROM OLD.service_id
     OR NEW.therapist_id       IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'FORBIDDEN_COLUMN_UPDATE: therapists may only update appointment status and clinical fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_therapist_booking_update_scope ON public.bookings;
CREATE TRIGGER enforce_therapist_booking_update_scope
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_therapist_booking_update_scope();

DROP POLICY IF EXISTS "Therapists can update booking status" ON public.bookings;
CREATE POLICY "Therapists can update booking status"
ON public.bookings FOR UPDATE TO authenticated
USING (
  therapist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = bookings.therapist_id AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  therapist_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = bookings.therapist_id AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Therapists can update bookings at assigned gyms" ON public.bookings;
CREATE POLICY "Therapists can update bookings at assigned gyms"
ON public.bookings FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL AND public.therapist_has_gym_access(auth.uid(), gym_id, booking_date))
WITH CHECK (auth.uid() IS NOT NULL AND public.therapist_has_gym_access(auth.uid(), gym_id, booking_date));

DROP POLICY IF EXISTS "Therapists can update bookings at assigned hotels" ON public.bookings;
CREATE POLICY "Therapists can update bookings at assigned hotels"
ON public.bookings FOR UPDATE TO authenticated
USING (hotel_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.therapist_has_hotel_access(auth.uid(), hotel_id, booking_date))
WITH CHECK (hotel_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.therapist_has_hotel_access(auth.uid(), hotel_id, booking_date));