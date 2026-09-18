
-- H-1 / H-2: public venue data must never include qr_code_id, commission_percentage or phone.

-- 1) Public, column-limited views. They must NOT be security_invoker, because anon
--    loses SELECT on the base tables below.
DROP VIEW IF EXISTS public.gyms_public;
CREATE VIEW public.gyms_public AS
SELECT id, city_id, country_id, name, address, image_url, rating, review_count,
       open_hours, is_active, created_at, updated_at
FROM public.gyms
WHERE is_active = true;
ALTER VIEW public.gyms_public SET (security_invoker = false);

DROP VIEW IF EXISTS public.hotels_public;
CREATE VIEW public.hotels_public AS
SELECT id, city_id, country_id, name, address, image_url, rating, review_count,
       star_rating, open_hours, is_active, created_at, updated_at
FROM public.hotels
WHERE is_active = true;
ALTER VIEW public.hotels_public SET (security_invoker = false);

GRANT SELECT ON public.gyms_public TO anon, authenticated;
GRANT SELECT ON public.hotels_public TO anon, authenticated;
GRANT ALL ON public.gyms_public TO service_role;
GRANT ALL ON public.hotels_public TO service_role;

-- 2) Remove blanket public read on the base tables (qr_code_id / commission_percentage / phone).
DROP POLICY IF EXISTS "Public can view active gyms" ON public.gyms;
DROP POLICY IF EXISTS "Public can view active hotels" ON public.hotels;
REVOKE SELECT ON public.gyms FROM anon;
REVOKE SELECT ON public.hotels FROM anon;
GRANT SELECT ON public.gyms TO authenticated;
GRANT SELECT ON public.hotels TO authenticated;
GRANT ALL ON public.gyms TO service_role;
GRANT ALL ON public.hotels TO service_role;

-- 3) Therapists keep read access to hotels they are scheduled at (gyms policy already exists).
DROP POLICY IF EXISTS "Therapists can view assigned hotels" ON public.hotels;
CREATE POLICY "Therapists can view assigned hotels"
ON public.hotels FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.therapist_weekly_schedules tws
    JOIN public.therapists t ON t.id = tws.therapist_id
    WHERE t.user_id = auth.uid() AND tws.hotel_id = hotels.id AND tws.is_active = true
  )
  OR EXISTS (
    SELECT 1 FROM public.therapist_assignments ta
    JOIN public.therapists t ON t.id = ta.therapist_id
    WHERE t.user_id = auth.uid() AND ta.hotel_id = hotels.id AND ta.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.therapist_hotels th
    JOIN public.therapists t ON t.id = th.therapist_id
    WHERE t.user_id = auth.uid() AND th.hotel_id = hotels.id
  )
);
