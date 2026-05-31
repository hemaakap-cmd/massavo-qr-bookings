import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";

export interface ManagedBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  total_amount: number;
  customer_name: string | null;
  canModify: boolean;
  hoursUntil: number;
  gym_id: string;
  gymName: string;
  gymAddress: string;
  hotel_id?: string | null;
  venueType?: "gym" | "hotel";
  service_id: string;
  serviceName: string;
  serviceDuration: number;
}

export function useManageBooking(token: string) {
  const bookingQuery = useQuery({
    queryKey: ["manage-booking", token],
    queryFn: async (): Promise<ManagedBooking> => {
      const { data, error } = await supabase.functions.invoke("manage-booking", {
        body: { token, action: "lookup" },
      });
      // Edge function may return non-2xx with a friendly error body — prefer data.error
      if (data && data.success === false) throw new Error(data.error || i18n.t("manageHook.notFound"));
      if (error) throw new Error(i18n.t("manageHook.notFoundOrCancelled"));
      if (!data?.success) throw new Error(i18n.t("manageHook.notFound"));
      return data.booking;
    },
    enabled: !!token,
    retry: false,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({
      newDate,
      newTime,
      customerEmail,
    }: {
      newDate: string;
      newTime: string;
      /** Required: must match the email used to book — defense against token-leak hijack. */
      customerEmail: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("manage-booking", {
        body: { token, action: "reschedule", newDate, newTime, customerEmail },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || i18n.t("manageHook.rescheduleFailed"));
      return data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { token, action: "token-cancel" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || i18n.t("manageHook.cancelFailed"));
      return data;
    },
  });

  return {
    booking: bookingQuery.data,
    isLoading: bookingQuery.isLoading,
    isError: bookingQuery.isError,
    error: bookingQuery.error,
    reschedule: rescheduleMutation,
    cancel: cancelMutation,
  };
}
