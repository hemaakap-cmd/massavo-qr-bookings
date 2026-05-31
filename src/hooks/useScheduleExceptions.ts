import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateAllBookingSystem } from "@/utils/cacheSync";
import type { ScheduleException, BookingReschedule } from "@/types/schedule";

export function useScheduleExceptions(gymId?: string) {
  const queryClient = useQueryClient();

  const exceptionsQuery = useQuery({
    queryKey: ["schedule-exceptions", gymId],
    queryFn: async () => {
      if (!gymId) return [];
      
      const { data, error } = await supabase
        .from("schedule_exceptions")
        .select("*")
        .eq("gym_id", gymId)
        .order("exception_date", { ascending: true });

      if (error) throw error;
      return data as ScheduleException[];
    },
    enabled: !!gymId,
  });

  const affectedBookingsQuery = useQuery({
    queryKey: ["affected-bookings", gymId],
    queryFn: async () => {
      if (!gymId) return [];
      
      const { data, error } = await supabase
        .from("booking_reschedules")
        .select(`
          *,
          booking:bookings(id, customer_name, customer_email, client_phone, service_id, gym_id),
          exception:schedule_exceptions(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter by gym_id through the booking relationship
      return (data as BookingReschedule[]).filter(
        (r) => r.booking?.gym_id === gymId
      );
    },
    enabled: !!gymId,
  });

  const createException = useMutation({
    mutationFn: async (exception: {
      gym_id: string;
      exception_date: string;
      reason?: string;
      alternative_date?: string;
      auto_action?: 'suggest_alternative' | 'auto_cancel';
      response_deadline_hours?: number;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("schedule_exceptions")
        .insert({
          ...exception,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Find and process affected bookings
      await processAffectedBookings(data.id, exception.gym_id, exception.exception_date, exception.alternative_date);
      
      return data;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
      toast.success("Exception created and affected bookings notified");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create exception: ${error.message}`);
    },
  });

  const deleteException = useMutation({
    mutationFn: async (exceptionId: string) => {
      const { error } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", exceptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(queryClient);
      toast.success("Exception removed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete exception: ${error.message}`);
    },
  });

  return {
    exceptions: exceptionsQuery.data ?? [],
    affectedBookings: affectedBookingsQuery.data ?? [],
    isLoading: exceptionsQuery.isLoading,
    isError: exceptionsQuery.isError,
    createException,
    deleteException,
    refetchAffectedBookings: affectedBookingsQuery.refetch,
  };
}

async function processAffectedBookings(
  exceptionId: string,
  gymId: string,
  exceptionDate: string,
  alternativeDate?: string
) {
  // Find bookings on the exception date
  const { data: affectedBookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, booking_date, booking_time, customer_email, client_phone")
    .eq("gym_id", gymId)
    .eq("booking_date", exceptionDate)
    .not("status", "in", '("cancelled","rescheduled")');

  if (bookingsError || !affectedBookings?.length) return;

  // Get exception details for deadline calculation
  const { data: exception } = await supabase
    .from("schedule_exceptions")
    .select("response_deadline_hours")
    .eq("id", exceptionId)
    .single();

  const deadlineHours = exception?.response_deadline_hours ?? 24;
  const responseDeadline = new Date();
  responseDeadline.setHours(responseDeadline.getHours() + deadlineHours);

  // Create reschedule records for each affected booking
  for (const booking of affectedBookings) {
    const { data: reschedule, error: rescheduleError } = await supabase
      .from("booking_reschedules")
      .insert({
        booking_id: booking.id,
        exception_id: exceptionId,
        original_date: booking.booking_date,
        original_time: booking.booking_time,
        suggested_date: alternativeDate || null,
        suggested_time: alternativeDate ? booking.booking_time : null,
        response_deadline: responseDeadline.toISOString(),
      })
      .select()
      .single();

    if (rescheduleError) {
      console.error("Failed to create reschedule record:", rescheduleError);
      continue;
    }

    // Trigger notification via edge function
    try {
      await supabase.functions.invoke("send-reschedule-notification", {
        body: {
          rescheduleId: reschedule.id,
          type: "initial",
        },
      });
    } catch (notifyError) {
      console.error("Failed to send notification:", notifyError);
    }
  }
}

export function useRescheduleResponse(token: string) {
  const queryClient = useQueryClient();

  const rescheduleQuery = useQuery({
    queryKey: ["reschedule", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_reschedule_by_token", { p_token: token });

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Reschedule not found");
      
      const row = data[0];
      
      const result: BookingReschedule = {
        id: row.id,
        booking_id: row.booking_id,
        exception_id: row.exception_id,
        original_date: row.original_date,
        original_time: row.original_time,
        suggested_date: row.suggested_date,
        suggested_time: row.suggested_time,
        selected_date: row.selected_date,
        selected_time: row.selected_time,
        status: row.status as BookingReschedule["status"],
        reschedule_token: row.reschedule_token,
        response_deadline: row.response_deadline,
        customer_responded_at: row.customer_responded_at,
        customer_notified_at: row.customer_notified_at,
        auto_processed_at: row.auto_processed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        booking: row.booking_gym_id ? {
          id: row.booking_id,
          customer_name: row.booking_customer_name,
          customer_email: row.booking_customer_email,
          client_phone: null,
          service_id: row.booking_service_id,
          gym_id: row.booking_gym_id,
        } : undefined,
      };
      
      return result;
    },
    enabled: !!token,
  });

  const respondToReschedule = useMutation({
    mutationFn: async ({
      action,
      selectedDate,
      selectedTime,
    }: {
      action: "confirm" | "select_alternative" | "cancel";
      selectedDate?: string;
      selectedTime?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("respond-to-reschedule", {
        body: {
          token,
          action,
          selectedDate,
          selectedTime,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to process response");

      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reschedule", token] });
      invalidateAllBookingSystem(queryClient);
      if (variables.action === "cancel") {
        toast.success("Booking cancelled successfully");
      } else {
        toast.success("Booking rescheduled successfully");
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to process response: ${error.message}`);
    },
  });

  return {
    reschedule: rescheduleQuery.data,
    isLoading: rescheduleQuery.isLoading,
    isError: rescheduleQuery.isError,
    respondToReschedule,
  };
}
