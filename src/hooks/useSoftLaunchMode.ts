import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads/writes the `soft_launch_mode` flag in system_settings.
 * Only super_admins can write (enforced by RLS).
 */
export function useSoftLaunchMode() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "soft_launch_mode")
        .maybeSingle();
      if (!cancelled) {
        const v = (data?.value as { enabled?: boolean } | null)?.enabled;
        setEnabled(Boolean(v));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("system_settings")
      .upsert({
        key: "soft_launch_mode",
        value: { enabled: next },
        updated_by: u.user?.id ?? null,
        updated_at: new Date().toISOString(),
      });
  };

  return { enabled, loading, toggle };
}