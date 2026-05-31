import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateBookingAndAssignments } from "@/utils/cacheSync";

export interface AdminBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  customer_email: string;
  status: string | null;
  payment_status: string | null;
  total_amount: number;
  notes: string | null;
  communication_preference: string | null;
  therapist_id: string | null;
  gym_id: string;
  service_id: string;
  gender: string | null;
  pregnancy_status: string | null;
  client_phone: string | null;
  client_address: string | null;
  date_of_birth: string | null;
  salutation: string | null;
  service: { name: string; duration_minutes: number } | null;
  gym: { id: string; name: string; address: string; phone: string | null } | null;
  therapist: { id: string; name: string } | null;
}

interface AdminBookingsParams {
  dateFrom: string;
  dateTo: string;
  gymId?: string | null;
  therapistId?: string | null;
}

export function useAdminAllBookings({ dateFrom, dateTo, gymId, therapistId }: AdminBookingsParams) {
  return useQuery({
    queryKey: ["admin-staff-bookings", dateFrom, dateTo, gymId, therapistId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("bookings")
        .select(`
          id, booking_date, booking_time, customer_name, customer_email,
          status, payment_status, total_amount, notes, communication_preference,
          therapist_id, gym_id, service_id,
          gender, pregnancy_status, client_phone, client_address, date_of_birth, salutation,
          services:service_id(name, duration_minutes),
          gyms:gym_id(id, name, address, phone),
          therapists:therapist_id(id, name)
        `)
        .gte("booking_date", dateFrom)
        .lte("booking_date", dateTo)
        .neq("status", "cancelled")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (gymId) query = query.eq("gym_id", gymId);
      if (therapistId) query = query.eq("therapist_id", therapistId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((b: any) => ({
        ...b,
        service: b.services,
        gym: b.gyms,
        therapist: b.therapists,
      })) as AdminBooking[];
    },
  });
}

export function useAdminAllTherapists() {
  return useQuery({
    queryKey: ["admin-all-therapists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id, name, email, phone, is_available, gym_id, gyms:gym_id(name), therapist_gyms(gym_id, is_primary, gyms(id, name))")
        .order("name");
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        gymName: t.therapist_gyms?.length
          ? t.therapist_gyms.map((tg: any) => tg.gyms?.name).filter(Boolean).join(", ")
          : t.gyms?.name || "—",
      }));
    },
  });
}

export function useAdminAllGyms() {
  return useQuery({
    queryKey: ["admin-all-gyms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gyms")
        .select("id, name, address, city_id, cities:city_id(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        cityName: g.cities?.name || "—",
      }));
    },
  });
}

export function useAdminUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      updates,
      auditAction,
    }: {
      bookingId: string;
      updates: Record<string, any>;
      auditAction: string;
    }) => {
      // Update booking
      const { error } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", bookingId);
      if (error) throw error;

      // Log audit
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: auditAction,
          entity_type: "booking",
          entity_id: bookingId,
          changes: updates,
        });
      }
    },
    onSuccess: () => {
      invalidateBookingAndAssignments(queryClient);
      toast.success("Booking updated");
    },
    onError: (err: any) => {
      toast.error("Update failed: " + err.message);
    },
  });
}

export function useAdminCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "cancel",
          entity_type: "booking",
          entity_id: bookingId,
          changes: { status: "cancelled" },
        });
      }
    },
    onSuccess: () => {
      invalidateBookingAndAssignments(queryClient);
      toast.success("Booking cancelled");
    },
    onError: (err: any) => {
      toast.error("Cancel failed: " + err.message);
    },
  });
}
