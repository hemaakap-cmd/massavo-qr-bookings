import { useEffect, useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useStaffRealtimeBookings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const therapistIdRef = useRef<string | null>(null);
  const assignedGymIdsRef = useRef<Set<string>>(new Set());

  // Resolve therapist_id and assigned gym IDs once
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data: therapist } = await supabase
        .from("therapists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      therapistIdRef.current = therapist?.id ?? null;

      if (therapist?.id) {
        // Get all gym IDs this therapist is assigned to via weekly schedules
        const { data: schedules } = await supabase
          .from("therapist_weekly_schedules")
          .select("gym_id")
          .eq("therapist_id", therapist.id)
          .eq("is_active", true);

        const gymIds = new Set((schedules || []).map((s: any) => s.gym_id));
        assignedGymIdsRef.current = gymIds;
      }
    })();
  }, [user]);

  const clearHighlight = useCallback((id: string) => {
    setTimeout(() => setHighlightedId((prev) => (prev === id ? null : prev)), 3000);
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("staff-bookings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        (payload) => {
          const tid = therapistIdRef.current;
          if (!tid) return;

          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          // Check relevance: either directly assigned OR at an assigned gym
          const isDirectlyAssigned =
            (newRow && newRow.therapist_id === tid) ||
            (oldRow && oldRow.therapist_id === tid);

          const isAtAssignedGym =
            (newRow && assignedGymIdsRef.current.has(newRow.gym_id)) ||
            (oldRow && assignedGymIdsRef.current.has(oldRow.gym_id));

          if (!isDirectlyAssigned && !isAtAssignedGym) return;

          if (payload.eventType === "INSERT") {
            toast.success("New booking assigned", {
              description: `${newRow.customer_name || "Client"} - ${newRow.booking_date}`,
            });
            setHighlightedId(newRow.id);
            clearHighlight(newRow.id);
          } else if (payload.eventType === "UPDATE") {
            if (oldRow?.therapist_id === tid && newRow?.therapist_id !== tid) {
              toast.info("Booking reassigned", {
                description: `${newRow.customer_name || "Client"} was reassigned`,
              });
            } else if (newRow.status === "cancelled") {
              toast.info("Booking cancelled", {
                description: `${newRow.customer_name || "Client"} - ${newRow.booking_date}`,
              });
            }
          } else if (payload.eventType === "DELETE") {
            toast.info("Booking removed");
          }

          queryClient.invalidateQueries({ queryKey: ["staff-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["staff-assigned-locations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "therapist_assignments" },
        (payload) => {
          const tid = therapistIdRef.current;
          if (!tid) return;

          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          const isRelevant =
            (newRow && newRow.therapist_id === tid) ||
            (oldRow && oldRow.therapist_id === tid);
          if (!isRelevant) return;

          if (payload.eventType === "INSERT") {
            toast.success("New gym assignment", {
              description: `You've been assigned for ${newRow.assignment_date}`,
            });
          } else if (payload.eventType === "DELETE") {
            toast.info("Assignment removed");
          }

          queryClient.invalidateQueries({ queryKey: ["staff-assignment"] });
          queryClient.invalidateQueries({ queryKey: ["staff-bookings"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "therapist_weekly_schedules" },
        (payload) => {
          const tid = therapistIdRef.current;
          if (!tid) return;

          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          const isRelevant =
            (newRow && newRow.therapist_id === tid) ||
            (oldRow && oldRow.therapist_id === tid);
          if (!isRelevant) return;

          if (payload.eventType === "INSERT") {
            toast.success("Neuer Wochenplan", {
              description: `Wochenplan wurde aktualisiert`,
            });
          } else if (payload.eventType === "UPDATE") {
            toast.info("Wochenplan geändert");
          } else if (payload.eventType === "DELETE") {
            toast.info("Wochenplan entfernt");
          }

          queryClient.invalidateQueries({ queryKey: ["staff-assignment"] });
          queryClient.invalidateQueries({ queryKey: ["staff-bookings"] });
          // Update gym access set
          if (tid) {
            supabase
              .from("therapist_weekly_schedules")
              .select("gym_id")
              .eq("therapist_id", tid)
              .eq("is_active", true)
              .then(({ data }) => {
                assignedGymIdsRef.current = new Set((data || []).map((s: any) => s.gym_id));
              });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [user, queryClient, clearHighlight]);

  return { isConnected, highlightedId };
}