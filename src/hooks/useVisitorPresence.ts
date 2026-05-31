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
      // Fetch visitor's city from multiple geolocation providers for accuracy
      let city = "Unknown";
      let country = "";
      
      // Provider 1: ipapi.co (HTTPS, free tier) — http://ip-api.com blocked by mixed-content + CSP
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const data = await res.json();
          if (data.city) { city = data.city; country = data.country_name || ""; }
        }
      } catch {
        // Try fallback
      }

      // Provider 2: fallback to ipapi.co if first failed
      if (city === "Unknown") {
        try {
          const res = await fetch("https://ipapi.co/json/");
          if (res.ok) {
            const data = await res.json();
            city = data.city || "Unknown";
            country = data.country_name || "";
          }
        } catch {
          // Try last fallback
        }
      }

      // Provider 3: fallback to ipwho.is
      if (city === "Unknown") {
        try {
          const res = await fetch("https://ipwho.is/");
          if (res.ok) {
            const data = await res.json();
            if (data.success !== false && data.city) {
              city = data.city;
              country = data.country || "";
            }
          }
        } catch {
          // All providers failed
        }
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
