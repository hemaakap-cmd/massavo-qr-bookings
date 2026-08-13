import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleCall, isAdminCall, unauthorized } from "../_shared/internal-auth.ts";
import {
  emailLayout,
  emailHeading,
  emailGreeting,
  emailParagraph,
  emailDetailTable,
  emailDetailRow,
  emailNotice,
  emailSignature,
  emailButton,
} from "../_shared/email-template.ts";


const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface BookingInfo {
  id: string;
  customer_name: string | null;
  customer_email: string;
  booking_date: string;
  booking_time: string;
  gym_name: string;
  service_name: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5) + " Uhr";
}

function buildEmail(booking: BookingInfo, action: string, newDate?: string, newTherapistName?: string): string {
  const name = booking.customer_name?.split(" ")[0] || "Kunde/Kundin";

  let heading = "";
  let explanation = "";
  let noticeVariant: "info" | "warning" | "success" = "info";
  let noticeText = "";
  let extraDetails = "";

  if (action === "reassigned") {
    heading = "Ihr Termin wurde einem neuen Therapeuten zugewiesen";
    explanation = "Aufgrund einer kurzfristigen Änderung wurde Ihr Termin einem anderen qualifizierten Therapeuten zugewiesen. Datum und Uhrzeit Ihres Termins bleiben unverändert.";
    noticeVariant = "info";
    noticeText = "Ihr Termin findet wie geplant statt — nur der/die Therapeut/in hat sich geändert.";
    if (newTherapistName) {
      extraDetails = emailDetailRow("Neue/r Therapeut/in", newTherapistName);
    }
  } else if (action === "postponed") {
    heading = "Ihr Termin wurde verschoben";
    explanation = "Leider mussten wir Ihren ursprünglichen Termin verschieben. Wir haben einen neuen Termin für Sie reserviert.";
    noticeVariant = "warning";
    noticeText = newDate
      ? `Ihr neuer Termin ist am ${formatDate(newDate)}.`
      : "Bitte kontaktieren Sie uns für einen neuen Termin.";
    if (newDate) {
      extraDetails = emailDetailRow("Neues Datum", formatDate(newDate));
    }
  } else if (action === "cancelled") {
    heading = "Ihr Termin wurde leider abgesagt";
    explanation = "Aufgrund unvorhergesehener Umstände mussten wir Ihren Termin absagen. Wir entschuldigen uns für die Unannehmlichkeiten.";
    noticeVariant = "warning";
    noticeText = "Eine vollständige Rückerstattung wird automatisch veranlasst.";
  }

  const content = [
    emailHeading(heading),
    emailGreeting(name),
    emailParagraph(explanation),
    emailDetailTable(
      emailDetailRow("Datum", formatDate(booking.booking_date)) +
      emailDetailRow("Uhrzeit", formatTime(booking.booking_time)) +
      emailDetailRow("Standort", booking.gym_name || "—") +
      emailDetailRow("Service", booking.service_name || "—") +
      extraDetails
    ),
    emailNotice(noticeText, noticeVariant),
    emailParagraph("Bei Fragen stehen wir Ihnen gerne zur Verfügung."),
    emailButton("Termin verwalten", `https://massavo-qr-bookings.lovable.app/manage-booking?id=${booking.id}`, "primary"),
    emailSignature(),
  ].join("");

  const subjects: Record<string, string> = {
    reassigned: "Therapeutenwechsel für Ihren Termin",
    postponed: "Ihr Termin wurde verschoben",
    cancelled: "Terminabsage",
  };

  return emailLayout(content);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only admins (or internal service-role calls) may trigger customer notifications
  if (!isServiceRoleCall(req) && !(await isAdminCall(req))) {
    return unauthorized(corsHeaders, 403);
  }

  try {
    const { bookings, action, newDate, newTherapistName } = await req.json() as {
      bookings: BookingInfo[];
      action: "reassigned" | "postponed" | "cancelled";
      newDate?: string;
      newTherapistName?: string;
    };

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!bookings?.length) throw new Error("No bookings to notify");

    const subjects: Record<string, string> = {
      reassigned: "Therapeutenwechsel für Ihren Massavo-Termin",
      postponed: "Ihr Massavo-Termin wurde verschoben",
      cancelled: "Absage Ihres Massavo-Termins",
    };

    const results = [];
    for (const booking of bookings) {
      const html = buildEmail(booking, action, newDate, newTherapistName);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Massavo <noreply@massavo.com>",
          to: [booking.customer_email],
          subject: subjects[action],
          html,
        }),
      });

      const resData = await res.json();
      results.push({ email: booking.customer_email, success: res.ok, data: resData });
    }

    const allSuccess = results.every(r => r.success);

    return new Response(JSON.stringify({ success: allSuccess, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: allSuccess ? 200 : 207,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
