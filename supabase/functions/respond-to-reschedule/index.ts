/**
 * respond-to-reschedule — customer response to a venue-initiated reschedule.
 *
 * SECURITY (remediation item 3). Fixed here:
 *
 *  1. Slot laundering: `select_alternative` accepted ANY `selectedDate`/
 *     `selectedTime` from the client and wrote it straight onto the booking — no
 *     format check, no future check, no therapist availability, no collision
 *     check. A customer (or anyone with a leaked token) could move a paid
 *     appointment to 03:00, to a past date, or on top of another customer.
 *     Every candidate slot is now validated against the booking window AND the
 *     authoritative venue availability RPCs.
 *  2. Check-then-update race: status was read, then updated in a separate
 *     statement, so two concurrent confirms both passed the `pending` check and
 *     both mutated the booking. The update is now CONDITIONAL on
 *     `status = 'pending'` (a single atomic statement) and is backed by a
 *     partial unique index guaranteeing at most one pending reschedule per
 *     booking.
 *  3. Collateral overwrite: the booking update touches only date/time/status —
 *     never the customer's notes or communication preference.
 *  4. Raw `error.message` was returned to the caller; responses are sanitised.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { clientErrorResponse, safeErrorResponse } from "../_shared/safe-error.ts";
import { validateBookingWindow } from "../_shared/booking-window.ts";
import { enforceRateLimit, tooManyRequests } from "../_shared/rate-limit.ts";

interface RescheduleResponseRequest {
  token: string;
  action: "confirm" | "select_alternative" | "cancel";
  selectedDate?: string;
  selectedTime?: string;
}

/**
 * Authoritative availability check for a candidate slot, using the same
 * SECURITY DEFINER RPCs the booking flow uses (they account for venue schedules,
 * therapist assignments, leave and existing bookings + buffers).
 */
async function slotIsAvailable(
  supabase: SupabaseClient,
  booking: { gym_id: string | null; hotel_id: string | null; home_city_id: string | null },
  date: string,
  time: string,
  durationMinutes: number,
): Promise<boolean> {
  try {
    if (booking.hotel_id) {
      const { data, error } = await supabase.rpc("check_hotel_slot_availability", {
        p_hotel_id: booking.hotel_id,
        p_date: date,
        p_time: time,
        p_duration_minutes: durationMinutes,
      });
      return !error && data === true;
    }
    if (booking.gym_id) {
      const { data, error } = await supabase.rpc("check_slot_availability", {
        p_gym_id: booking.gym_id,
        p_date: date,
        p_time: time,
        p_duration_minutes: durationMinutes,
      });
      return !error && data === true;
    }
    if (booking.home_city_id) {
      const { data, error } = await supabase.rpc("check_home_slot_availability", {
        p_city_id: booking.home_city_id,
        p_date: date,
        p_time: time,
        p_duration_minutes: durationMinutes,
      });
      return !error && data === true;
    }
  } catch (e) {
    console.error("[respond-to-reschedule] availability check failed:", e instanceof Error ? e.message : e);
  }
  // No resolvable venue, or the check errored → refuse rather than guess.
  return false;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = (await req.json().catch(() => null)) as RescheduleResponseRequest | null;
    if (!body) return clientErrorResponse(corsHeaders, "Invalid request body");

    const { token, action, selectedDate, selectedTime } = body;

    if (!token || typeof token !== "string" || token.length < 20 || !action) {
      return clientErrorResponse(corsHeaders, "Missing or invalid token/action");
    }
    if (!["confirm", "select_alternative", "cancel"].includes(action)) {
      return clientErrorResponse(corsHeaders, "Invalid action type");
    }

    // Throttle token guessing durably (not per-isolate).
    const limit = await enforceRateLimit(
      req,
      { action: "reschedule_response", subjectMax: 10, subjectWindowMinutes: 60, ipMax: 30, ipWindowMinutes: 60, blockMinutes: 60 },
      token.slice(0, 24),
      supabase,
    );
    if (!limit.allowed) return tooManyRequests(corsHeaders, limit);

    // ---- TOKEN OWNERSHIP -------------------------------------------------
    const { data: reschedule, error: fetchError } = await supabase
      .from("booking_reschedules")
      .select("*")
      .eq("reschedule_token", token)
      .maybeSingle();

    if (fetchError) {
      return safeErrorResponse(corsHeaders, "respond-to-reschedule.fetch", fetchError, "Unable to load this request.");
    }
    if (!reschedule) {
      return clientErrorResponse(corsHeaders, "Invalid or expired token", 404);
    }
    if (reschedule.status !== "pending") {
      return clientErrorResponse(corsHeaders, "This reschedule request has already been processed");
    }
    if (new Date(reschedule.response_deadline) < new Date()) {
      return clientErrorResponse(corsHeaders, "The response deadline has passed");
    }

    // Booking context (venue + duration) for availability validation.
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, status, gym_id, hotel_id, home_city_id, therapist_id, service:services(duration_minutes)")
      .eq("id", reschedule.booking_id)
      .maybeSingle();

    if (bookingErr) {
      return safeErrorResponse(corsHeaders, "respond-to-reschedule.booking", bookingErr, "Unable to load this request.");
    }
    if (!booking || booking.status === "cancelled") {
      return clientErrorResponse(corsHeaders, "This booking is no longer active", 409);
    }
    const serviceRel = Array.isArray(booking.service) ? booking.service[0] : booking.service;
    const durationMinutes = Number((serviceRel as { duration_minutes?: number } | null)?.duration_minutes) || 60;

    // ---- DECIDE + VALIDATE THE TARGET SLOT -------------------------------
    const updates: {
      customer_responded_at: string;
      status?: string;
      selected_date?: string | null;
      selected_time?: string | null;
    } = { customer_responded_at: new Date().toISOString() };

    if (action === "confirm" || action === "select_alternative") {
      const candidateDate = action === "confirm" ? reschedule.suggested_date : selectedDate;
      const candidateTime = action === "confirm" ? reschedule.suggested_time : selectedTime;

      if (!candidateDate || !candidateTime) {
        return clientErrorResponse(
          corsHeaders,
          action === "confirm"
            ? "No alternative slot was proposed for this booking."
            : "selectedDate and selectedTime are required.",
        );
      }

      // Format + booking-window authority (rejects past and far-future slots).
      const window = validateBookingWindow(candidateDate, candidateTime);
      if (!window.valid) {
        return clientErrorResponse(corsHeaders, window.error ?? "Invalid appointment slot.");
      }
      const normalizedTime = window.normalizedTime!;

      // Authoritative availability: venue schedule, therapist assignment/leave,
      // and no collision with an existing booking (incl. buffers).
      const available = await slotIsAvailable(
        supabase,
        booking as { gym_id: string | null; hotel_id: string | null; home_city_id: string | null },
        candidateDate,
        normalizedTime,
        durationMinutes,
      );
      if (!available) {
        return clientErrorResponse(
          corsHeaders,
          "This appointment slot is no longer available. Please choose another time.",
          409,
        );
      }

      updates.status = "confirmed";
      updates.selected_date = candidateDate;
      updates.selected_time = normalizedTime;
    } else {
      updates.status = "declined";
    }

    // ---- ATOMIC STATE TRANSITION -----------------------------------------
    // Conditional on status='pending': two concurrent responses cannot both win.
    const { data: updatedReschedule, error: updateError } = await supabase
      .from("booking_reschedules")
      .update(updates)
      .eq("id", reschedule.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (updateError) {
      return safeErrorResponse(corsHeaders, "respond-to-reschedule.update", updateError, "Failed to update this request.");
    }
    if (!updatedReschedule) {
      // Lost the race — another request already processed this token.
      return clientErrorResponse(corsHeaders, "This reschedule request has already been processed", 409);
    }

    // Only date/time/status are touched — customer notes and communication
    // preference are deliberately left untouched.
    if (updates.status === "confirmed" && updates.selected_date) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({
          booking_date: updates.selected_date,
          booking_time: updates.selected_time,
          status: "rescheduled",
        })
        .eq("id", reschedule.booking_id)
        .neq("status", "cancelled");

      if (bookingUpdateError) {
        console.error("[respond-to-reschedule] booking update failed:", bookingUpdateError.message);
      }
    } else if (updates.status === "declined") {
      const { error: bookingCancelError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", reschedule.booking_id)
        .neq("status", "cancelled");

      if (bookingCancelError) {
        console.error("[respond-to-reschedule] booking cancellation failed:", bookingCancelError.message);
      }
    }

    try {
      await supabase.functions.invoke("send-reschedule-notification", {
        body: {
          rescheduleId: reschedule.id,
          type: updates.status === "confirmed" ? "confirmation" : "cancellation",
        },
      });
    } catch (notifyError) {
      console.error("[respond-to-reschedule] notification failed:", notifyError instanceof Error ? notifyError.message : notifyError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === "cancel" ? "Booking cancelled successfully" : "Booking rescheduled successfully",
        data: updatedReschedule,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return safeErrorResponse(corsHeaders, "respond-to-reschedule", error);
  }
});
