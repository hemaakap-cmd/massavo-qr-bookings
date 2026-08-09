import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

interface RescheduleResponseRequest {
  token: string;
  action: "confirm" | "select_alternative" | "cancel";
  selectedDate?: string;
  selectedTime?: string;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role to bypass RLS - we validate the token ourselves
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { token, action, selectedDate, selectedTime }: RescheduleResponseRequest = await req.json();

    // Validate required fields
    if (!token || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: token and action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action type
    if (!["confirm", "select_alternative", "cancel"].includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid action type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch reschedule by token - this validates the token server-side
    const { data: reschedule, error: fetchError } = await supabase
      .from("booking_reschedules")
      .select("*")
      .eq("reschedule_token", token)
      .single();

    if (fetchError || !reschedule) {
      console.error("Token validation failed:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already processed
    if (reschedule.status !== "pending") {
      return new Response(
        JSON.stringify({ success: false, error: "This reschedule request has already been processed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if deadline has passed
    if (new Date(reschedule.response_deadline) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "The response deadline has passed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update payload based on action
    interface UpdatePayload {
      customer_responded_at: string;
      status?: string;
      selected_date?: string | null;
      selected_time?: string | null;
    }
    
    const updates: UpdatePayload = {
      customer_responded_at: new Date().toISOString(),
    };

    if (action === "confirm") {
      updates.status = "confirmed";
      updates.selected_date = reschedule.suggested_date;
      updates.selected_time = reschedule.suggested_time;
    } else if (action === "select_alternative") {
      if (!selectedDate || !selectedTime) {
        return new Response(
          JSON.stringify({ success: false, error: "selectedDate and selectedTime required for select_alternative action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updates.status = "confirmed";
      updates.selected_date = selectedDate;
      updates.selected_time = selectedTime;
    } else {
      updates.status = "declined";
    }

    // Update the reschedule record
    const { data: updatedReschedule, error: updateError } = await supabase
      .from("booking_reschedules")
      .update(updates)
      .eq("id", reschedule.id)
      .select()
      .single();

    if (updateError) {
      console.error("Update failed:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update reschedule" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the original booking
    if (updates.status === "confirmed" && updates.selected_date) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({
          booking_date: updates.selected_date,
          booking_time: updates.selected_time,
          status: "rescheduled",
        })
        .eq("id", reschedule.booking_id);

      if (bookingUpdateError) {
        console.error("Booking update failed:", bookingUpdateError);
      }
    } else if (updates.status === "declined") {
      const { error: bookingCancelError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", reschedule.booking_id);

      if (bookingCancelError) {
        console.error("Booking cancellation failed:", bookingCancelError);
      }
    }

    // Send confirmation/cancellation notification
    const notificationType = updates.status === "confirmed" ? "confirmation" : "cancellation";
    try {
      await supabase.functions.invoke("send-reschedule-notification", {
        body: {
          rescheduleId: reschedule.id,
          type: notificationType,
        },
      });
    } catch (notifyError) {
      console.error("Failed to send notification:", notifyError);
      // Don't fail the request if notification fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: action === "cancel" ? "Booking cancelled successfully" : "Booking rescheduled successfully",
        data: updatedReschedule
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Reschedule response error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
