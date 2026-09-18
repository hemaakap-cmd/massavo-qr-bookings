
-- Replace the definer views with invoker views + column-level grants, so no
-- SECURITY DEFINER view is needed and anon can never read qr_code_id,
-- commission_percentage or phone from the base tables either.
ALTER VIEW public.gyms_public SET (security_invoker = true);
ALTER VIEW public.hotels_public SET (security_invoker = true);

GRANT SELECT (id, city_id, country_id, name, address, image_url, rating, review_count,
              open_hours, is_active, created_at, updated_at)
  ON public.gyms TO anon;
GRANT SELECT (id, city_id, country_id, name, address, image_url, rating, review_count,
              star_rating, open_hours, is_active, created_at, updated_at)
  ON public.hotels TO anon;

CREATE POLICY "Public can view safe active gym fields"
ON public.gyms FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Public can view safe active hotel fields"
ON public.hotels FOR SELECT TO anon USING (is_active = true);
