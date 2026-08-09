DROP POLICY IF EXISTS "Admins insert non-super roles in country" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update non-super roles in country" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete non-super roles in country" ON public.user_roles;

CREATE POLICY "Admins insert non-super roles in country"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id <> auth.uid()
  AND country_id IS NOT NULL
  AND has_country_access(auth.uid(), country_id)
);

CREATE POLICY "Admins update non-super roles in country"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id <> auth.uid()
  AND country_id IS NOT NULL
  AND has_country_access(auth.uid(), country_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id <> auth.uid()
  AND country_id IS NOT NULL
  AND has_country_access(auth.uid(), country_id)
);

CREATE POLICY "Admins delete non-super roles in country"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND role <> 'super_admin'::app_role
  AND user_id <> auth.uid()
  AND country_id IS NOT NULL
  AND has_country_access(auth.uid(), country_id)
);