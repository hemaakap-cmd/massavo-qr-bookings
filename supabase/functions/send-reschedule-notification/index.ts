import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailButton, emailNotice,
  emailSignature, emailDivider, emailSubheading,
} from "../_shared/email-template.ts";
import { resolveVenue } from "../_shared/venue.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleCall, isAdminCall, unauthorized } from "../_shared/internal-auth.ts";


interface NotificationRequest {
  rescheduleId: string;
  type: "initial" | "reminder" | "confirmation" | "cancellation";
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only: invoked server-to-server by the reschedule workflow
  if (!isServiceRoleCall(req) && !(await isAdminCall(req))) {
    return unauthorized(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { rescheduleId, type }: NotificationRequest = await req.json();

    const { data: reschedule, error: fetchError } = await supabase
      .from("booking_reschedules")
      .select(`*, booking:bookings(id, customer_name, customer_email, client_phone, gym_id, hotel_id, service:services(name, duration_minutes), gym:gyms(name, address), hotel:hotels(name, address)), exception:schedule_exceptions(reason, alternative_date)`)
      .eq("id", rescheduleId)
      .single();

    if (fetchError || !reschedule) throw new Error(`Failed to fetch reschedule: ${fetchError?.message}`);

    const booking = reschedule.booking;
    const exception = reschedule.exception;
    if (!booking?.customer_email) throw new Error("No customer email found");

    // Multi-venue: pick hotel if hotel_id present, else gym
    const gymRel = Array.isArray(booking.gym) ? booking.gym[0] : booking.gym;
    const hotelRel = Array.isArray(booking.hotel) ? booking.hotel[0] : booking.hotel;
    const venueRel = booking.hotel_id ? hotelRel : gymRel;
    const venueName = venueRel?.name || "Standort";
    const venueAddress = venueRel?.address || "";

    const rescheduleUrl = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/reschedule?token=${reschedule.reschedule_token}`;

    const fmtDate = (d: string) => new Date(d).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const originalDate = fmtDate(reschedule.original_date);
    const suggestedDate = reschedule.suggested_date ? fmtDate(reschedule.suggested_date) : null;
    const deadlineDate = new Date(reschedule.response_deadline).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
    const customerName = booking.customer_name || "";

    let subject = "";
    let htmlContent = "";

    switch (type) {
      case "initial": {
        subject = `Terminänderung – ${originalDate}`;
        const content = `
          ${emailHeading("Terminänderung erforderlich")}
          ${emailGreeting(customerName)}
          ${emailNotice(`Ihr geplanter Termin am <strong>${originalDate}</strong> bei <strong>${venueName}</strong> kann leider nicht stattfinden.${exception?.reason ? ` Grund: ${exception.reason}` : ""}`, "warning")}
          ${emailSubheading("Ursprünglicher Termin")}
          ${emailDetailTable(
            emailDetailRow("Datum", originalDate) +
            emailDetailRow("Uhrzeit", reschedule.original_time.slice(0, 5) + " Uhr") +
            emailDetailRow("Service", booking.service?.name || "") +
            emailDetailRow("Standort", venueName)
          )}
          ${suggestedDate ? `
            ${emailSubheading("Alternativvorschlag")}
            ${emailDetailTable(
              emailDetailRow("Datum", suggestedDate) +
              emailDetailRow("Uhrzeit", (reschedule.suggested_time?.slice(0, 5) || reschedule.original_time.slice(0, 5)) + " Uhr")
            )}
          ` : ""}
          ${emailParagraph("Bitte wählen Sie eine der folgenden Optionen:")}
          <div style="text-align:center;">
            ${suggestedDate ? emailButton("Alternativtermin bestätigen", `${rescheduleUrl}&action=confirm`) : ""}
            ${emailButton("Anderen Termin wählen", `${rescheduleUrl}&action=select`, "secondary")}
            ${emailButton("Buchung stornieren", `${rescheduleUrl}&action=cancel`, "danger")}
          </div>
          ${emailNotice(`Bitte antworten Sie bis spätestens <strong>${deadlineDate}</strong>. Nach Ablauf der Frist wird ${suggestedDate ? "der Alternativtermin automatisch bestätigt" : "Ihre Buchung automatisch storniert"}.`, "info")}
          ${emailSignature()}
        `;
        htmlContent = emailLayout(content);
        break;
      }

      case "confirmation": {
        subject = "Neuer Termin bestätigt";
        const confirmedDate = reschedule.selected_date ? fmtDate(reschedule.selected_date) : suggestedDate;
        const confirmedTime = (reschedule.selected_time || reschedule.suggested_time || reschedule.original_time).slice(0, 5);
        const content = `
          ${emailHeading("Termin bestätigt")}
          ${emailGreeting(customerName)}
          ${emailNotice("Ihr neuer Termin wurde erfolgreich bestätigt.", "success")}
          ${emailSubheading("Termindetails")}
          ${emailDetailTable(
            emailDetailRow("Datum", confirmedDate || "") +
            emailDetailRow("Uhrzeit", confirmedTime + " Uhr") +
            emailDetailRow("Service", booking.service?.name || "") +
            emailDetailRow("Standort", `${venueName}, ${venueAddress}`)
          )}
          ${emailParagraph("Wir freuen uns auf Ihren Besuch!")}
          ${emailSignature()}
        `;
        htmlContent = emailLayout(content);
        break;
      }

      case "cancellation": {
        subject = "Buchung storniert";
        const content = `
          ${emailHeading("Buchung storniert")}
          ${emailGreeting(customerName)}
          ${emailNotice(`Ihre Buchung für den <strong>${originalDate}</strong> wurde storniert.`, "error")}
          ${emailParagraph("Falls Sie einen neuen Termin buchen möchten, besuchen Sie bitte unsere Website.")}
          ${emailSignature()}
        `;
        htmlContent = emailLayout(content);
        break;
      }

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    if (resendApiKey) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Massavo <noreply@massavo.com>", to: [booking.customer_email], subject, html: htmlContent }),
      });
      if (!emailRes.ok) throw new Error(`Resend error: ${await emailRes.text()}`);
    }

    await supabase.from("reschedule_notifications").insert({
      reschedule_id: rescheduleId, notification_type: type, delivery_channel: "email",
      recipient_email: booking.customer_email, sent_at: new Date().toISOString(), delivery_status: "sent",
    });

    await supabase.from("booking_reschedules").update({ customer_notified_at: new Date().toISOString() }).eq("id", rescheduleId);

    return new Response(JSON.stringify({ success: true, message: "Notification sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Notification error:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
