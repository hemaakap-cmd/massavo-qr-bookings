-- Recreate therapists_public with default (owner) security semantics,
-- matching gyms_public/hotels_public, so anon reads go through the view only.
CREATE OR REPLACE VIEW public.therapists_public
AS
SELECT id, name, gym_id, city_id, specialty, education, profession, rating, image_url, is_available, created_at, updated_at
FROM public.therapists
WHERE is_available = true;

GRANT SELECT ON public.therapists_public TO anon;
GRANT SELECT ON public.therapists_public TO authenticated;