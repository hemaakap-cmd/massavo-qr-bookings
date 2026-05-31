import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invalidateAllBookingSystem, invalidateBookingAndAssignments } from "@/utils/cacheSync";
import { fetchTherapistsOnLeave } from "@/hooks/useTherapistLeaves";

export interface AffectedBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  customer_email: string;
  status: string | null;
  total_amount: number;
  notes: string | null;
  therapist_id: string | null;
  gym_id: string | null;
  hotel_id: string | null;
  service_id: string;
  gender: string | null;
  client_phone: string | null;
  service: { name: string; duration_minutes: number } | null;
  gym: { id: string; name: string; address: string } | null;
  hotel: { id: string; name: string; address: string } | null;
  venue_name: string | null;
  venue_type: "gym" | "hotel";
  therapist: { id: string; name: string } | null;
}

export interface AvailableReplacement {
  id: string;
  name: string;
  gender: string | null;
  source: "weekly" | "daily";
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/**
 * Timezone-safe day-of-week from "YYYY-MM-DD"
 */
function getDayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d); // local date, no timezone shift
  return DAY_NAMES[date.getDay()];
}

/**
 * Fetch all bookings for a therapist on a given date (confirmed/pending).
 * Also includes unassigned bookings at gyms where this therapist is the
 * only scheduled therapist on that day — those would also be affected.
 */
export function useAffectedBookings(therapistId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["absence-affected-bookings", therapistId, date],
    enabled: !!therapistId && !!date,
    queryFn: async () => {
      // 1. Directly assigned bookings
      const { data: directBookings, error: e1 } = await (supabase as any)
        .from("bookings")
        .select(`
          id, booking_date, booking_time, customer_name, customer_email,
          status, total_amount, notes, therapist_id, gym_id, hotel_id, service_id, gender, client_phone,
          services:service_id(name, duration_minutes),
          gyms:gym_id(id, name, address),
          hotels:hotel_id(id, name, address),
          therapists:therapist_id(id, name)
        `)
        .eq("therapist_id", therapistId)
        .eq("booking_date", date)
        .in("status", ["confirmed", "pending"])
        .order("booking_time", { ascending: true });

      if (e1) throw e1;

      // 2. Find venues (gyms + hotels) where this therapist is scheduled on this day
      const dayName = getDayOfWeek(date!);
      const { data: scheduledGyms } = await supabase
        .from("therapist_weekly_schedules")
        .select("gym_id, hotel_id")
        .eq("therapist_id", therapistId!)
        .eq("day_of_week", dayName as any)
        .eq("is_active", true);

      // Also check daily assignments
      const { data: dailyGyms } = await supabase
        .from("therapist_assignments")
        .select("gym_id, hotel_id")
        .eq("therapist_id", therapistId!)
        .eq("assignment_date", date!)
        .eq("status", "active");

      const gymIds = new Set([
        ...(scheduledGyms || []).map((g: any) => g.gym_id).filter(Boolean),
        ...(dailyGyms || []).map((g: any) => g.gym_id).filter(Boolean),
      ]);
      const hotelIds = new Set([
        ...(scheduledGyms || []).map((g: any) => g.hotel_id).filter(Boolean),
        ...(dailyGyms || []).map((g: any) => g.hotel_id).filter(Boolean),
      ]);

      // 3. Find unassigned bookings at those gyms on that date
      const directIds = new Set((directBookings || []).map((b: any) => b.id));
      let unassignedBookings: any[] = [];

      if (gymIds.size > 0 || hotelIds.size > 0) {
        const orParts: string[] = [];
        if (gymIds.size > 0) orParts.push(`gym_id.in.(${Array.from(gymIds).join(",")})`);
        if (hotelIds.size > 0) orParts.push(`hotel_id.in.(${Array.from(hotelIds).join(",")})`);
        const { data: gymBookings } = await (supabase as any)
          .from("bookings")
          .select(`
            id, booking_date, booking_time, customer_name, customer_email,
            status, total_amount, notes, therapist_id, gym_id, hotel_id, service_id, gender, client_phone,
            services:service_id(name, duration_minutes),
            gyms:gym_id(id, name, address),
            hotels:hotel_id(id, name, address),
            therapists:therapist_id(id, name)
          `)
          .or(orParts.join(","))
          .eq("booking_date", date)
          .is("therapist_id", null)
          .in("status", ["confirmed", "pending"])
          .order("booking_time", { ascending: true });

        unassignedBookings = (gymBookings || []).filter((b: any) => !directIds.has(b.id));
      }

      const all = [...(directBookings || []), ...unassignedBookings];
      return all.map((b: any) => ({
        ...b,
        service: b.services,
        gym: b.gyms,
        hotel: b.hotels,
        venue_name: b.hotels?.name || b.gyms?.name || null,
        venue_type: b.hotel_id ? "hotel" : "gym",
        therapist: b.therapists,
      })) as AffectedBooking[];
    },
  });
}

/**
 * Find available replacement therapists for a gym on a date.
 * Checks BOTH weekly schedules AND daily assignments (consistent with useStaffAssignment).
 * Also excludes therapists with known schedule exceptions on that date.
 */
export function useAvailableReplacements(gymId: string | null, date: string | null, excludeTherapistId: string | null) {
  return useQuery({
    queryKey: ["available-replacements", gymId, date, excludeTherapistId],
    enabled: !!gymId && !!date && !!excludeTherapistId,
    queryFn: async () => {
      const dayName = getDayOfWeek(date!);
      const seen = new Set<string>();
      const results: AvailableReplacement[] = [];

      // 1. Weekly schedules
      const { data: weeklyData } = await supabase
        .from("therapist_weekly_schedules")
        .select("therapist_id, therapists:therapist_id(id, name, gender, is_available)")
        .eq("gym_id", gymId!)
        .eq("day_of_week", dayName as any)
        .eq("is_active", true)
        .neq("therapist_id", excludeTherapistId!);

      for (const s of weeklyData || []) {
        const t = (s as any).therapists;
        if (!t || !t.is_available || seen.has(t.id)) continue;
        seen.add(t.id);
        results.push({ id: t.id, name: t.name, gender: t.gender, source: "weekly" });
      }

      // 2. Daily assignments (override/emergency)
      const { data: dailyData } = await supabase
        .from("therapist_assignments")
        .select("therapist_id, therapists:therapist_id(id, name, gender, is_available)")
        .eq("gym_id", gymId!)
        .eq("assignment_date", date!)
        .eq("status", "active")
        .neq("therapist_id", excludeTherapistId!);

      for (const a of dailyData || []) {
        const t = (a as any).therapists;
        if (!t || !t.is_available || seen.has(t.id)) continue;
        seen.add(t.id);
        results.push({ id: t.id, name: t.name, gender: t.gender, source: "daily" });
      }

      // 3. Exclude therapists who have attendance status 'absent' on this date
      const { data: absentRecords } = await supabase
        .from("therapist_attendance")
        .select("therapist_id")
        .eq("work_date", date!)
        .in("status", ["absent", "sick"] as any[]);

      const absentIds = new Set((absentRecords || []).map((r: any) => r.therapist_id));

      // 3b. Exclude therapists on approved/pending leave
      const leaveIds = await fetchTherapistsOnLeave(date!);
      for (const id of leaveIds) absentIds.add(id);

      // 4. Check if the gym itself has a schedule exception (disabled) on this date
      const { data: gymException } = await supabase
        .from("schedule_exceptions")
        .select("id")
        .eq("gym_id", gymId!)
        .eq("exception_date", date!)
        .eq("is_disabled", true)
        .maybeSingle();

      // If the gym is disabled on this date, no replacements are available there
      if (gymException) return [];

      return results.filter((r) => !absentIds.has(r.id));
    },
  });
}

export function useReassignBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, newTherapistId }: { bookingId: string; newTherapistId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ therapist_id: newTherapistId })
        .eq("id", bookingId);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "absence_reassign",
          entity_type: "booking",
          entity_id: bookingId,
          changes: { new_therapist_id: newTherapistId, reason: "therapist_absence" },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      toast.success("Termin umgebucht");
    },
    onError: (e: any) => toast.error("Umbuchung fehlgeschlagen: " + e.message),
  });
}

/**
 * Postpone booking: moves booking to a new date/time using atomic DB function.
 * Uses advisory locks + schedule validation to prevent double-bookings.
 */
export function usePostponeBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, newDate, newTime }: { bookingId: string; newDate: string; newTime: string }) => {
      // Use atomic move function with advisory locks and schedule validation
      const { data, error } = await supabase.rpc("move_booking_atomic" as any, {
        p_booking_id: bookingId,
        p_new_date: newDate,
        p_new_time: newTime,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        const errorMessages: Record<string, string> = {
          BOOKING_NOT_FOUND: "Buchung nicht gefunden oder bereits storniert.",
          SLOT_OCCUPIED: "Der gewählte Zeitslot ist bereits belegt.",
          SLOT_UNAVAILABLE: "Der Zeitslot liegt außerhalb der Arbeitszeiten oder in der Pause.",
        };
        throw new Error(errorMessages[result?.error] || "Verschiebung fehlgeschlagen.");
      }

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "absence_postpone",
          entity_type: "booking",
          entity_id: bookingId,
          changes: {
            original_date: result.original_date,
            original_time: result.original_time,
            new_date: newDate,
            new_time: newTime,
            reason: "therapist_absence",
          },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      toast.success("Termin verschoben");
    },
    onError: (e: any) => toast.error("Verschiebung fehlgeschlagen: " + e.message),
  });
}

export function useBulkReassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingIds, newTherapistId }: { bookingIds: string[]; newTherapistId: string }) => {
      for (const id of bookingIds) {
        const { error } = await supabase
          .from("bookings")
          .update({ therapist_id: newTherapistId })
          .eq("id", id);
        if (error) throw error;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "absence_bulk_reassign",
          entity_type: "booking",
          entity_id: bookingIds[0],
          changes: { booking_count: bookingIds.length, new_therapist_id: newTherapistId, reason: "therapist_absence" },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      toast.success("Alle Termine umgebucht");
    },
    onError: (e: any) => toast.error("Umbuchung fehlgeschlagen: " + e.message),
  });
}

export function useCancelAbsenceBookings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingIds: string[]) => {
      for (const id of bookingIds) {
        const { error } = await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", id);
        if (error) throw error;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "absence_bulk_cancel",
          entity_type: "booking",
          entity_id: bookingIds[0],
          changes: { booking_count: bookingIds.length, reason: "therapist_absence" },
        });
      }
    },
    onSuccess: () => {
      invalidateAllBookingSystem(qc);
      toast.success("Termine abgesagt");
    },
    onError: (e: any) => toast.error("Absage fehlgeschlagen: " + e.message),
  });
}

export function useNotifyAffectedCustomers() {
  return useMutation({
    mutationFn: async ({
      bookings,
      action,
      newDate,
      newTherapistName,
    }: {
      bookings: AffectedBooking[];
      action: "reassigned" | "postponed" | "cancelled";
      newDate?: string;
      newTherapistName?: string;
    }) => {
      const response = await supabase.functions.invoke("notify-absence-change", {
        body: {
          bookings: bookings.map(b => ({
            id: b.id,
            customer_name: b.customer_name,
            customer_email: b.customer_email,
            booking_date: b.booking_date,
            booking_time: b.booking_time,
            gym_name: b.gym?.name,
            service_name: b.service?.name,
          })),
          action,
          newDate,
          newTherapistName,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.bookings.length} Kunde(n) benachrichtigt`);
    },
    onError: (e: any) => toast.error("Benachrichtigung fehlgeschlagen: " + e.message),
  });
}
