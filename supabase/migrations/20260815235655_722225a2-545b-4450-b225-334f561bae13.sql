-- No anonymous access at all
REVOKE ALL ON public.booking_feedback FROM anon;

-- Authenticated users keep read/write but not delete (super admin delete happens via service role)
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.booking_feedback FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.booking_feedback TO authenticated;
GRANT ALL ON public.booking_feedback TO service_role;

-- Therapist reads: only submitted, non-flagged feedback tied to their own booking
DROP POLICY IF EXISTS "Therapists can view own feedback" ON public.booking_feedback;
CREATE POLICY "Therapists can view own feedback"
ON public.booking_feedback
FOR SELECT
TO authenticated
USING (
  is_submitted = true
  AND is_flagged = false
  AND EXISTS (
    SELECT 1
    FROM public.therapists t
    JOIN public.bookings b ON b.id = booking_feedback.booking_id
    WHERE t.user_id = auth.uid()
      AND t.id = booking_feedback.therapist_id
      AND b.therapist_id = t.id
  )
);

-- Fix swapped arguments in the gym admin policy
DROP POLICY IF EXISTS "Admins can manage feedback in assigned countries" ON public.booking_feedback;
CREATE POLICY "Admins can manage feedback in assigned countries"
ON public.booking_feedback
FOR ALL
TO authenticated
USING (
  gym_id IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
  AND has_country_access(auth.uid(), get_gym_country_id(gym_id))
)
WITH CHECK (
  gym_id IS NOT NULL
  AND has_role(auth.uid(), 'admin'::app_role)
  AND has_country_access(auth.uid(), get_gym_country_id(gym_id))
);