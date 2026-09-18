-- S-1: remove anonymous write privileges (defense-in-depth; RLS unchanged).
-- SELECT grants are untouched: services keeps anon SELECT (public catalog);
-- gyms/hotels anon SELECT was already revoked (public access via gyms_public/hotels_public views).
REVOKE INSERT, UPDATE, DELETE ON public.services FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gyms FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.hotels FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.therapists FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;