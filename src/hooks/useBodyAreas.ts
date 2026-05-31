import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { SelectedArea } from "@/components/body-diagram/BodyDiagram";
import type { BodyArea } from "@/components/body-diagram/BodyDiagram";

export function useBookingBodyAreas(bookingId: string | null) {
  return useQuery({
    queryKey: ["booking-body-areas", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_body_areas")
        .select("*")
        .eq("booking_id", bookingId!);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        code: a.area_code,
        label: a.area_label,
        side: a.side as "front" | "back",
        painIntensity: a.pain_intensity || 5,
        isFocus: a.is_focus || false,
        notes: a.notes || "",
        dbId: a.id,
      }));
    },
  });
}

export function useBodyAreaHistory(customerEmail: string | null, currentBookingId: string | null) {
  return useQuery({
    queryKey: ["body-area-history", customerEmail, currentBookingId],
    enabled: !!customerEmail,
    queryFn: async () => {
      // Get all bookings for this customer
      const { data: bookings, error: bErr } = await supabase
        .from("bookings")
        .select("id, booking_date, booking_time, services(name)")
        .eq("customer_email", customerEmail!)
        .order("booking_date", { ascending: false })
        .limit(20);
      if (bErr) throw bErr;
      if (!bookings?.length) return [];

      const bookingIds = bookings.map(b => b.id);
      const { data: areas, error: aErr } = await supabase
        .from("booking_body_areas")
        .select("*")
        .in("booking_id", bookingIds);
      if (aErr) throw aErr;

      return bookings.map(b => ({
        bookingId: b.id,
        date: b.booking_date,
        time: b.booking_time,
        serviceName: (b.services as any)?.name || "Unknown",
        isCurrent: b.id === currentBookingId,
        areas: (areas || [])
          .filter(a => a.booking_id === b.id)
          .map(a => ({
            code: a.area_code,
            label: a.area_label,
            side: a.side as "front" | "back",
            painIntensity: a.pain_intensity || 5,
            isFocus: a.is_focus || false,
            notes: a.notes || "",
          })),
      }));
    },
  });
}

export function useBodyAreaChangeLogs(bookingId: string | null) {
  return useQuery({
    queryKey: ["body-area-logs", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_area_change_logs")
        .select("*")
        .eq("booking_id", bookingId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSaveBodyAreas(bookingId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const saveArea = useMutation({
    mutationFn: async (area: SelectedArea) => {
      // Upsert: check if area exists
      const { data: existing } = await supabase
        .from("booking_body_areas")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("area_code", area.code)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("booking_body_areas")
          .update({
            pain_intensity: area.painIntensity,
            is_focus: area.isFocus || false,
            notes: area.notes || null,
            created_by: user?.id || null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("booking_body_areas")
          .insert({
            booking_id: bookingId,
            area_code: area.code,
            area_label: area.label,
            side: area.side,
            pain_intensity: area.painIntensity,
            is_focus: area.isFocus || false,
            notes: area.notes || null,
            created_by: user?.id || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-body-areas", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["body-area-logs", bookingId] });
    },
  });

  const removeArea = useMutation({
    mutationFn: async (areaCode: string) => {
      const { error } = await supabase
        .from("booking_body_areas")
        .delete()
        .eq("booking_id", bookingId)
        .eq("area_code", areaCode);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-body-areas", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["body-area-logs", bookingId] });
    },
  });

  return { saveArea, removeArea };
}
