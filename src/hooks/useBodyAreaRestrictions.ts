import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BodyAreaRestriction {
  area_code: string;
  is_allowed: boolean;
  reason: string | null;
}

export function useBodyAreaRestrictions() {
  return useQuery({
    queryKey: ["body-area-restrictions"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("body_area_restrictions")
        .select("area_code, is_allowed, reason");
      if (error) throw error;
      return (data || []) as BodyAreaRestriction[];
    },
  });
}

export function useDisallowedAreaCodes() {
  const { data: restrictions = [] } = useBodyAreaRestrictions();
  const disallowed = new Set(
    restrictions.filter((r) => !r.is_allowed).map((r) => r.area_code)
  );
  return disallowed;
}
