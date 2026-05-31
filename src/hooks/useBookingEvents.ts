import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface BookingEvent {
  id: string;
  booking_id: string | null;
  event_type: string;
  gym_id: string | null;
  hotel_id: string | null;
  venue_type: string | null;
  booking_date: string | null;
  booking_time: string | null;
  customer_name: string | null;
  customer_email: string | null;
  details: Record<string, unknown>;
  severity: string;
  created_at: string;
  gyms?: { name: string; country_id?: string | null } | null;
  hotels?: { name: string; country_id?: string | null } | null;
}

interface UseBookingEventsOptions {
  venueFilter?: string; // value format: "gym:<id>" | "hotel:<id>" | "all"
  venueTypeFilter?: string; // "gym" | "hotel" | "all"
  eventTypeFilter?: string;
  severityFilter?: string;
  countryId?: string;
  limit?: number;
  realtime?: boolean;
}

export const useBookingEvents = (options: UseBookingEventsOptions = {}) => {
  const {
    venueFilter,
    venueTypeFilter,
    eventTypeFilter,
    severityFilter,
    countryId,
    limit = 100,
    realtime = true,
  } = options;
  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    let query = supabase
      .from("booking_events")
      .select("*, gyms:gym_id(name, country_id), hotels:hotel_id(name, country_id)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (countryId) {
      // Match events whose gym OR hotel belongs to the active country.
      query = query.or(
        `and(gym_id.not.is.null,gyms.country_id.eq.${countryId}),and(hotel_id.not.is.null,hotels.country_id.eq.${countryId})`,
      );
    }
    if (venueTypeFilter === "gym") {
      query = query.not("gym_id", "is", null);
    } else if (venueTypeFilter === "hotel") {
      query = query.not("hotel_id", "is", null);
    }
    if (venueFilter && venueFilter !== "all") {
      const [type, id] = venueFilter.split(":");
      if (type === "hotel" && id) query = query.eq("hotel_id", id);
      else if (type === "gym" && id) query = query.eq("gym_id", id);
    }
    if (eventTypeFilter && eventTypeFilter !== "all") {
      query = query.eq("event_type", eventTypeFilter);
    }
    if (severityFilter && severityFilter !== "all") {
      query = query.eq("severity", severityFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching booking events:", error);
    } else {
      setEvents((data as unknown as BookingEvent[]) || []);
    }
    setLoading(false);
  }, [venueFilter, venueTypeFilter, eventTypeFilter, severityFilter, countryId, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime) return;

    const channel = supabase
      .channel("booking-events-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_events" },
        (payload) => {
          const newEvent = payload.new as unknown as BookingEvent;

          // Always refetch to respect active country scope and joins
          fetchEvents();

          if (newEvent.severity === "warning" || newEvent.severity === "error") {
            toast({
              title: newEvent.severity === "error" ? "⚠️ Critical Event" : "⚠ Warning",
              description: `${newEvent.event_type}: ${newEvent.customer_name || newEvent.customer_email || "Unknown"}`,
              variant: "destructive",
            });
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtime, limit, toast, fetchEvents]);

  const stats = {
    total: events.length,
    created: events.filter((e) => e.event_type === "created").length,
    cancelled: events.filter((e) => e.event_type === "cancelled").length,
    rescheduled: events.filter((e) => e.event_type === "rescheduled").length,
    conflicts: events.filter((e) => e.event_type === "conflict_blocked").length,
    paymentFailed: events.filter((e) => e.event_type === "payment_failed").length,
    errors: events.filter((e) => e.severity === "error").length,
    warnings: events.filter((e) => e.severity === "warning").length,
  };

  return { events, loading, realtimeConnected, stats, refetch: fetchEvents };
};
