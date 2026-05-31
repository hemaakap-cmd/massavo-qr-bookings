import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportClientIncident } from "@/lib/observability";

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "disconnected" | "lag";

/**
 * Batch E: Global realtime health probe.
 * Subscribes to a lightweight presence channel and tracks connection state +
 * last heartbeat timestamp. Does NOT subscribe to any postgres_changes.
 */
export function useRealtimeHealth() {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const lagTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const channel = supabase.channel("realtime-health-probe", {
      config: { presence: { key: "probe" } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setLastMessageAt(Date.now());
        setStatus("connected");
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          setStatus("connected");
          setLastMessageAt(Date.now());
          channel.track({ online_at: new Date().toISOString() }).catch(() => {});
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("reconnecting");
          reportClientIncident({
            source: "client.realtime",
            message: `Realtime ${s}`,
            fingerprint: `realtime|${s}`,
            severity: "warning",
          });
        } else if (s === "CLOSED") {
          setStatus("disconnected");
          reportClientIncident({
            source: "client.realtime",
            message: "Realtime channel closed",
            fingerprint: "realtime|closed",
            severity: "warning",
          });
        }
      });

    // Detect lag — no message for >60s while supposedly connected
    lagTimerRef.current = window.setInterval(() => {
      setStatus((prev) => {
        if (prev !== "connected" || !lastMessageAt) return prev;
        if (Date.now() - lastMessageAt > 60_000) return "lag";
        return prev;
      });
    }, 15_000);

    return () => {
      if (lagTimerRef.current) window.clearInterval(lagTimerRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, lastMessageAt };
}