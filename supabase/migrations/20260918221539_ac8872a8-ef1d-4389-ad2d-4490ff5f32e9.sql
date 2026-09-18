-- Close gyms/hotels public exposure findings:
-- 1. Make the public views definer-owned so they expose only their fixed safe column list
ALTER VIEW public.gyms_public RESET (security_invoker);
ALTER VIEW public.hotels_public RESET (security_invoker);

-- 2. Drop the anon base-table policies entirely (public reads now go through the views only)
DROP POLICY IF EXISTS "Public can view safe active gym fields" ON public.gyms;
DROP POLICY IF EXISTS "Public can view safe active hotel fields" ON public.hotels;

-- 3. Revoke the anon column-level SELECT grants on the base tables
REVOKE SELECT (id, name, address, city_id, country_id, image_url, open_hours, rating, review_count, is_active, created_at, updated_at) ON public.gyms FROM anon;
REVOKE SELECT (id, name, address, city_id, country_id, image_url, open_hours, rating, review_count, star_rating, is_active, created_at, updated_at) ON public.hotels FROM anon;