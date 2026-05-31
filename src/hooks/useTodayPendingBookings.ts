import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export const useTodayPendingBookings = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["todayPendingBookings"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { count, error } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("booking_date", today)
        .eq("status", "pending");

      if (error) {
        console.error("Error fetching pending bookings:", error);
        return 0;
      }

      return count || 0;
    },
    enabled,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};
