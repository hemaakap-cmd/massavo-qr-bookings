CREATE POLICY "Admins can manage home visit weekly schedules in assigned countries"
ON public.therapist_weekly_schedules
FOR ALL
TO authenticated
USING (
  gym_id IS NULL
  AND hotel_id IS NULL
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1
    FROM public.therapist_cities tc
    JOIN public.cities c ON c.id = tc.city_id
    WHERE tc.therapist_id = therapist_weekly_schedules.therapist_id
      AND public.has_country_access(auth.uid(), c.country_id)
  )
)
WITH CHECK (
  gym_id IS NULL
  AND hotel_id IS NULL
  AND public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1
    FROM public.therapist_cities tc
    JOIN public.cities c ON c.id = tc.city_id
    WHERE tc.therapist_id = therapist_weekly_schedules.therapist_id
      AND public.has_country_access(auth.uid(), c.country_id)
  )
);