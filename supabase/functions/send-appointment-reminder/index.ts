import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleCall, isAdminCall, unauthorized } from "../_shared/internal-auth.ts";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailButton, emailNotice,
  emailSignature, emailSubheading,
} from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


function sanitizeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(timeStr: string): string {
  return timeStr.substring(0, 5) + " Uhr";
}

function generateReminderEmail(data: {
  customerName: string | null;
  gymName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  managementLink: string | null;
}): string {
  const name = data.customerName ? sanitizeHtml(data.customerName) : "geschätzte/r Kunde/in";
  const content = `
    ${emailHeading("Terminerinnerung")}
    ${emailGreeting(name)}
    ${emailParagraph("Dies ist eine freundliche Erinnerung an Ihren morgigen Termin bei Massavo.")}
    ${emailSubheading("Ihre Termindetails")}
    ${emailDetailTable(
      emailDetailRow("Datum", sanitizeHtml(formatDate(data.bookingDate))) +
      emailDetailRow("Uhrzeit", sanitizeHtml(formatTime(data.bookingTime))) +
      emailDetailRow("Standort", sanitizeHtml(data.gymName)) +
      emailDetailRow("Service", sanitizeHtml(data.serviceName))
    )}
    ${emailNotice("Bitte erscheinen Sie 10 Minuten vor Ihrem geplanten Termin.", "info")}
    ${data.managementLink ? `
      <div style="text-align:center;margin:18px 0 8px;">
        ${emailButton("Buchung verwalten", data.managementLink, "secondary")}
      </div>
      ${emailNotice("Änderungen müssen mindestens 24 Stunden vor Ihrem Termin vorgenommen werden.", "warning")}
    ` : ""}
    ${emailParagraph("Wir freuen uns auf Ihren Besuch!")}
    ${emailSignature()}
  `;
  return emailLayout(content);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal/cron-only: require the service-role key or an admin JWT
  if (!isServiceRoleCall(req) && !(await isAdminCall(req))) {
    return unauthorized(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find confirmed bookings happening in the next 22-26 hours that haven't received a reminder
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDate = tomorrow.toISOString().split("T")[0];

    console.log(`Checking for bookings on ${tomorrowDate} needing reminders...`);

    // Get bookings for tomorrow that haven't been reminded
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        id, customer_email, customer_name, booking_date, booking_time,
        cancellation_token,
        gym_id, hotel_id, service_id
      `)
      .eq("booking_date", tomorrowDate)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
      throw new Error("Failed to fetch bookings");
    }

    if (!bookings || bookings.length === 0) {
      console.log("No bookings need reminders today.");
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${bookings.length} bookings needing reminders.`);

    // Fetch gym, hotel, and service names for all bookings
    const gymIds = [...new Set(bookings.map(b => b.gym_id).filter(Boolean))];
    const hotelIds = [...new Set(bookings.map(b => b.hotel_id).filter(Boolean))];
    const serviceIds = [...new Set(bookings.map(b => b.service_id))];

    const [gymsResult, hotelsResult, servicesResult] = await Promise.all([
      gymIds.length ? supabase.from("gyms").select("id, name").in("id", gymIds) : Promise.resolve({ data: [] }),
      hotelIds.length ? supabase.from("hotels").select("id, name").in("id", hotelIds) : Promise.resolve({ data: [] }),
      supabase.from("services").select("id, name").in("id", serviceIds),
    ]);

    const gymMap = new Map((gymsResult.data || []).map(g => [g.id, g.name]));
    const hotelMap = new Map((hotelsResult.data || []).map(h => [h.id, h.name]));
    const serviceMap = new Map((servicesResult.data || []).map(s => [s.id, s.name]));

    let sentCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        const gymName = booking.hotel_id
          ? (hotelMap.get(booking.hotel_id) || "Massavo Standort")
          : (gymMap.get(booking.gym_id) || "Massavo Standort");
        const serviceName = serviceMap.get(booking.service_id) || "Massage";
        const managementLink = booking.cancellation_token
          ? `https://massavo-qr-bookings.lovable.app/manage-booking?token=${encodeURIComponent(booking.cancellation_token)}`
          : null;

        const html = generateReminderEmail({
          customerName: booking.customer_name,
          gymName,
          serviceName,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          managementLink,
        });

        const emailResult = await resend.emails.send({
          from: "Massavo <noreply@massavo.com>",
          to: [booking.customer_email],
          subject: `Terminerinnerung – ${serviceName} morgen um ${booking.booking_time.substring(0, 5)} Uhr`,
          html,
        });

        console.log(`Reminder sent to ${booking.customer_email}:`, emailResult);

        // Mark as sent
        await supabase
          .from("bookings")
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq("id", booking.id);

        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, emailError);
        errorCount++;
      }
    }

    console.log(`Reminders complete: ${sentCount} sent, ${errorCount} failed.`);

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sentCount, errors: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reminder function error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process appointment reminders." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
