-- 1) Tighten booking_feedback SELECT scoping to authenticated roles only
DROP POLICY IF EXISTS "Therapists can view own feedback" ON public.booking_feedback;
CREATE POLICY "Therapists can view own feedback"
ON public.booking_feedback
FOR SELECT
TO authenticated
USING (
  is_submitted = true
  AND EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = booking_feedback.therapist_id
      AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Super admins can manage all feedback" ON public.booking_feedback;
CREATE POLICY "Super admins can manage all feedback"
ON public.booking_feedback
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Narrow realtime publication payloads to non-sensitive columns
ALTER TABLE public.bookings REPLICA IDENTITY DEFAULT;
ALTER TABLE public.booking_feedback REPLICA IDENTITY DEFAULT;
ALTER TABLE public.booking_events REPLICA IDENTITY DEFAULT;

ALTER PUBLICATION supabase_realtime DROP TABLE public.bookings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.booking_feedback;
ALTER PUBLICATION supabase_realtime DROP TABLE public.booking_events;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings
  (id, gym_id, hotel_id, therapist_id, service_id, booking_date, booking_time, status, payment_status, created_at, updated_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_feedback
  (id, booking_id, gym_id, hotel_id, therapist_id, is_submitted, submitted_at, created_at, updated_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_events
  (id, booking_id, gym_id, hotel_id, event_type, severity, created_at);