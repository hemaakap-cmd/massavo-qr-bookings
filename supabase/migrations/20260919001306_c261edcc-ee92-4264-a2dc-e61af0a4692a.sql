-- Remove anonymous/authenticated direct SELECT on the base therapists table.
-- Public therapist data is served exclusively through the therapists_public view,
-- which excludes latitude/longitude and other non-essential fields.
DROP POLICY IF EXISTS "Public can view available therapists" ON public.therapists;

-- Ensure the base table grants do not allow direct reads by anon
REVOKE SELECT ON public.therapists FROM anon;

-- Public-safe view (already excludes latitude/longitude and internal fields)
GRANT SELECT ON public.therapists_public TO anon;
GRANT SELECT ON public.therapists_public TO authenticated;