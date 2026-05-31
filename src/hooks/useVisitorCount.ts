import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VisitorDetail {
  id: string;
  page: string;
  city: string;
  country: string;
  online_at: string;
}

interface VisitorInfo {
  count: number;
  connected: boolean;
  visitors: VisitorDetail[];
}

/**
 * Subscribes to the visitor presence channel and returns the live count + details.
 * For use in admin dashboards.
 */
export function useVisitorCount(): VisitorInfo {
  const [count, setCount] = useState(0);
  const [visitors, setVisitors] = useState<VisitorDetail[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel("site-visitors", {
      config: { presence: { key: `admin-${crypto.randomUUID()}` } },
    });

    const syncCount = () => {
      const state = channel.presenceState();
      const visitorEntries: VisitorDetail[] = [];

      Object.entries(state).forEach(([key, presences]) => {
        if (key.startsWith("admin-")) return;
        const p = (presences as any[])[0];
        visitorEntries.push({
          id: key,
          page: p?.page || "/",
          city: p?.city || "Unknown",
          country: p?.country || "",
          online_at: p?.online_at || "",
        });
      });

      setCount(visitorEntries.length);
      setVisitors(visitorEntries);
    };

    channel
      .on("presence", { event: "sync" }, syncCount)
      .on("presence", { event: "join" }, syncCount)
      .on("presence", { event: "leave" }, syncCount)
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { count, connected, visitors };
}
