import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateAllBookingSystem } from "@/utils/cacheSync";

export interface TherapistLeave {
  id: string;
  therapist_id: string;
  leave_type: "vacation" | "sick" | "personal" | "emergency";
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  therapist?: { id: string; name: string; gender: string | null } | null;
}

export function useTherapistLeaves(filters?: {
  therapistId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ["therapist-leaves", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("therapist_leaves")
        .select("*, therapists:therapist_id(id, name, gender)")
        .order("start_date", { ascending: false });

      if (filters?.therapistId) query = query.eq("therapist_id", filters.therapistId);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.dateFrom) query = query.gte("end_date", filters.dateFrom);
      if (filters?.dateTo) query = query.lte("start_date", filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((l: any) => ({
        ...l,
        therapist: l.therapists,
      })) as TherapistLeave[];
    },
  });
}

/**
 * Check if a therapist is on leave for a specific date.
 * Used by availability and replacement logic.
 */
export function useTherapistOnLeave(therapistId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["therapist-on-leave", therapistId, date],
    enabled: !!therapistId && !!date,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("therapist_leaves")
        .select("id, leave_type, status")
        .eq("therapist_id", therapistId)
        .in("status", ["approved", "pending"])
        .lte("start_date", date)
        .gte("end_date", date)
        .limit(1);

      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
  });
}

/**
 * Get all therapist IDs on leave for a given date.
 * Used to filter out unavailable therapists in replacement search.
 */
export async function fetchTherapistsOnLeave(date: string): Promise<Set<string>> {
  const { data } = await (supabase as any)
    .from("therapist_leaves")
    .select("therapist_id")
    .in("status", ["approved", "pending"])
    .lte("start_date", date)
    .gte("end_date", date);

  return new Set((data || []).map((r: any) => r.therapist_id));
}

/**
 * Get affected bookings for a leave period (all dates in range).
 */
export function useLeaveAffectedBookings(therapistId: string | null, startDate: string | null, endDate: string | null) {
  return useQuery({
    queryKey: ["leave-affected-bookings", therapistId, startDate, endDate],
    enabled: !!therapistId && !!startDate && !!endDate,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bookings")
        .select(`
          id, booking_date, booking_time, customer_name, customer_email,
          status, total_amount, therapist_id, gym_id, service_id, gender, client_phone,
          services:service_id(name, duration_minutes),
          gyms:gym_id(id, name, address),
          therapists:therapist_id(id, name)
        `)
        .eq("therapist_id", therapistId)
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .in("status", ["confirmed", "pending"])
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (error) throw error;

      return (data || []).map((b: any) => ({
        ...b,
        service: b.services,
        gym: b.gyms,
        therapist: b.therapists,
      }));
    },
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leave: {
      therapist_id: string;
      leave_type: string;
      start_date: string;
      end_date: string;
      reason?: string;
      status?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("therapist_leaves")
        .insert({
          therapist_id: leave.therapist_id,
          leave_type: leave.leave_type,
          start_date: leave.start_date,
          end_date: leave.end_date,
          reason: leave.reason || null,
          status: leave.status || "approved",
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "leave_created",
          entity_type: "therapist_leave",
          entity_id: data.id,
          changes: {
            therapist_id: leave.therapist_id,
            leave_type: leave.leave_type,
            start_date: leave.start_date,
            end_date: leave.end_date,
            status: leave.status || "approved",
          },
        });
      }

      return data;
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      qc.invalidateQueries({ queryKey: ["therapist-leaves"] });
      qc.invalidateQueries({ queryKey: ["therapist-on-leave"] });
      toast.success("Urlaub/Abwesenheit eingetragen");
    },
    onError: (e: any) => toast.error("Fehler: " + e.message),
  });
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leaveId, status }: { leaveId: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await (supabase as any)
        .from("therapist_leaves")
        .update({
          status,
          approved_by: status === "approved" ? user?.id : null,
        })
        .eq("id", leaveId);

      if (error) throw error;

      // Audit log
      if (user) {
        const actionMap: Record<string, string> = {
          approved: "leave_approved",
          rejected: "leave_rejected",
          cancelled: "leave_cancelled",
        };
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: actionMap[status] || "leave_updated",
          entity_type: "therapist_leave",
          entity_id: leaveId,
          changes: { new_status: status },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      qc.invalidateQueries({ queryKey: ["therapist-leaves"] });
      qc.invalidateQueries({ queryKey: ["therapist-on-leave"] });
      toast.success("Status aktualisiert");
    },
    onError: (e: any) => toast.error("Fehler: " + e.message),
  });
}

export function useCancelLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leaveId: string) => {
      const { error } = await (supabase as any)
        .from("therapist_leaves")
        .update({ status: "cancelled" })
        .eq("id", leaveId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "leave_cancelled",
          entity_type: "therapist_leave",
          entity_id: leaveId,
          changes: { reason: "admin_cancellation" },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      qc.invalidateQueries({ queryKey: ["therapist-leaves"] });
      qc.invalidateQueries({ queryKey: ["therapist-on-leave"] });
      toast.success("Urlaub storniert");
    },
    onError: (e: any) => toast.error("Fehler: " + e.message),
  });
}
