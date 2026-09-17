import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks this visitor's presence on the site using Supabase Realtime Presence.
 * Should only be rendered for non-admin/non-staff users (handled by VisitorTracker).
 * Includes visitor's city via IP geolocation.
 */
export function useVisitorPresence() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Approximate region comes from our own backend (visitor-region), which
      // derives it from edge metadata it already receives. No third-party
      // geolocation service is contacted from the browser, and no IP is stored.
      let city = "Unknown";
      let country = "";

      try {
        const { data } = await supabase.functions.invoke("visitor-region");
        if (data && typeof data === "object") {
          const d = data as { city?: string; country?: string };
          if (d.city) city = d.city;
          if (d.country) country = d.country;
        }
      } catch {
        // Region stays "Unknown" — presence tracking still works.
      }

      if (!mounted) return;

      const visitorId = crypto.randomUUID();
      const channel = supabase.channel("site-visitors", {
        config: { presence: { key: visitorId } },
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            online_at: new Date().toISOString(),
            page: window.location.pathname,
            city,
            country,
          });
        }
      });

      channelRef.current = channel;

      // Update page on navigation
      const handlePopState = () => {
        channel.track({
          online_at: new Date().toISOString(),
          page: window.location.pathname,
          city,
          country,
        });
      };
      window.addEventListener("popstate", handlePopState);
      (channel as any)._popStateHandler = handlePopState;
    };

    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        const handler = (channelRef.current as any)._popStateHandler;
        if (handler) window.removeEventListener("popstate", handler);
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);
}
