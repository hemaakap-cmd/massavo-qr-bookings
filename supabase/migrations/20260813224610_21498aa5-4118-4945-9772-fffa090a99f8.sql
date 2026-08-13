DROP POLICY IF EXISTS "Anyone can view submitted public feedback" ON public.booking_feedback;

REVOKE SELECT ON public.booking_feedback FROM anon;

CREATE POLICY "Authenticated users can view submitted public feedback"
ON public.booking_feedback
FOR SELECT
TO authenticated
USING (is_submitted = true AND is_flagged = false);