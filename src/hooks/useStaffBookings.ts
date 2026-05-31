import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { invalidateBookingCaches } from "@/utils/cacheSync";

export interface StaffBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  customer_email: string;
  status: string | null;
  payment_status: string | null;
  notes: string | null;
  communication_preference: string | null;
  gender: string | null;
  pregnancy_status: string | null;
  gym_id: string | null;
  hotel_id: string | null;
  therapist_id: string | null;
  service: { name: string; duration_minutes: number } | null;
  gym: { id: string; name: string; address: string; phone: string | null } | null;
  hotel: { id: string; name: string; address: string; phone: string | null } | null;
}

interface StaffBookingsParams {
  dateFrom: string;
  dateTo: string;
}

/**
 * Fetches all bookings visible to the therapist.
 * RLS policies (therapist_has_gym_access) ensure they only see
 * bookings at their assigned gyms + bookings directly assigned to them.
 */
export function useStaffBookings({ dateFrom, dateTo }: StaffBookingsParams) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["staff-bookings", user?.id, dateFrom, dateTo],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(`
          id, booking_date, booking_time, customer_name, customer_email,
          status, payment_status, notes, communication_preference,
          gender, pregnancy_status, gym_id, hotel_id, therapist_id,
          services:service_id(name, duration_minutes),
          gyms:gym_id(id, name, address, phone),
          hotels:hotel_id(id, name, address, phone)
        `)
        .gte("booking_date", dateFrom)
        .lte("booking_date", dateTo)
        .neq("status", "cancelled")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (error) throw error;

      return (data || []).map((b: any) => ({
        ...b,
        service: b.services,
        gym: b.gyms,
        hotel: b.hotels,
      })) as StaffBooking[];
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateBookingCaches(queryClient);
      toast.success("Booking status updated");
    },
    onError: (err: any) => {
      toast.error("Failed to update status: " + err.message);
    },
  });
}
