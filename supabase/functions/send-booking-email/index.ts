import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailButton, emailNotice,
  emailSignature, emailDivider, emailSubheading,
} from "../_shared/email-template.ts";
import { t, formatDateLocalized, formatTimeLocalized, formatCurrency } from "../_shared/email-i18n.ts";
import type { EmailLang } from "../_shared/email-i18n.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


const ADMIN_EMAIL = "info@massavo.com";
const MAX_LENGTH = { email: 255, name: 100, gymName: 100, serviceName: 100, bookingId: 50 };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("required") || message.includes("Missing")) return "Missing required booking information.";
  if (message.includes("format") || message.includes("Invalid")) return "Invalid input format. Please check your data.";
  if (message.includes("too long") || message.includes("length")) return "Input exceeds maximum length.";
  return "Unable to send booking confirmation. Please contact support.";
}

interface BookingEmailRequest {
  customerEmail: string;
  customerName?: string;
  gymName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  totalAmount: number;
  bookingId: string;
  cancellationToken?: string;
  gender?: string;
  pregnancyStatus?: string;
  gymId?: string;
  hotelId?: string;
  venueType?: "gym" | "hotel";
}

/** Resolve language from venue (gym or hotel) → country */
async function resolveLanguage(gymId: string | undefined, hotelId?: string): Promise<EmailLang> {
  if (!gymId && !hotelId) return "de";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const table = hotelId ? "hotels" : "gyms";
    const id = hotelId || gymId;
    const { data: venue } = await supabase
      .from(table)
      .select("country_id, country:countries(default_language)")
      .eq("id", id!)
      .maybeSingle();

    const countryData = Array.isArray(venue?.country) ? venue.country[0] : venue?.country;
    const lang = countryData?.default_language;
    if (lang === "ar" || lang === "en" || lang === "de") return lang as EmailLang;
  } catch (e) {
    console.error("[SEND-EMAIL] Language resolution failed:", e);
  }
  return "de";
}

function generateManagementLink(cancellationToken: string): string {
  return `https://massavo-qr-bookings.lovable.app/manage-booking?token=${encodeURIComponent(cancellationToken)}`;
}

function generateCustomerEmail(data: BookingEmailRequest, managementLink: string | null, bookingCode: string | null, lang: EmailLang): string {
  const name = data.customerName ? sanitizeHtml(data.customerName) : t("default_customer", lang);
  const content = `
    ${emailHeading(t("booking_confirmed_heading", lang), lang)}
    ${emailGreeting(name, lang)}
    ${emailParagraph(t("booking_confirmed_thanks", lang), lang)}
    ${emailSubheading(t("appointment_details", lang), lang)}
    ${emailDetailTable(
      emailDetailRow(t("label_location", lang), sanitizeHtml(data.gymName), lang) +
      emailDetailRow(t("label_service", lang), sanitizeHtml(data.serviceName), lang) +
      emailDetailRow(t("label_date", lang), formatDateLocalized(data.bookingDate, lang), lang) +
      emailDetailRow(t("label_time", lang), formatTimeLocalized(data.bookingTime, lang), lang) +
      emailDetailRow(t("label_amount", lang), formatCurrency(data.totalAmount, lang), lang)
    )}
    ${emailNotice(t("arrive_early", lang), "info", lang)}
    ${emailDivider()}
    ${emailSubheading(t("policy_heading", lang), lang)}
    ${emailNotice(t("policy_cancellation", lang), "warning", lang)}
    ${emailNotice(t("policy_towel", lang), "info", lang)}
    ${data.gender === "female" && data.pregnancyStatus === "not_pregnant" ? emailNotice(t("pregnancy_notice", lang), "warning", lang) : ""}
    ${managementLink ? `
      ${emailDivider()}
      ${emailSubheading(t("manage_booking_heading", lang), lang)}
      ${emailParagraph(t("manage_booking_desc", lang), lang)}
      <div style="text-align:center;">${emailButton(t("manage_booking_btn", lang), managementLink)}</div>
      ${bookingCode ? `<p style="margin:8px 0 0;text-align:center;font-size:11px;color:#a09a94;">${t("booking_code", lang)}: <strong style="font-family:monospace;letter-spacing:1px;">${bookingCode}</strong></p>` : ""}
    ` : ""}
    ${emailNotice(t("therapist_privacy", lang), "info", lang)}
    ${emailSignature(lang)}
  `;
  return emailLayout(content, undefined, lang);
}

function generateAdminEmail(data: BookingEmailRequest): string {
  const content = `
    ${emailHeading("Neue Buchung eingegangen")}
    ${emailParagraph("Eine neue Buchung wurde bestätigt und bezahlt.")}
    ${emailSubheading("Kundeninformation")}
    ${emailDetailTable(
      emailDetailRow("Name", sanitizeHtml(data.customerName || "Guest")) +
      emailDetailRow("E-Mail", `<a href="mailto:${sanitizeHtml(data.customerEmail)}" style="color:#7a4a2a;">${sanitizeHtml(data.customerEmail)}</a>`)
    )}
    ${emailSubheading("Buchungsdetails")}
    ${emailDetailTable(
      emailDetailRow("Buchungs-ID", `<span style="font-family:monospace;font-size:11px;">${sanitizeHtml(data.bookingId)}</span>`) +
      emailDetailRow("Standort", sanitizeHtml(data.gymName)) +
      emailDetailRow("Service", sanitizeHtml(data.serviceName)) +
      emailDetailRow("Datum", sanitizeHtml(data.bookingDate)) +
      emailDetailRow("Uhrzeit", sanitizeHtml(data.bookingTime)) +
      emailDetailRow("Umsatz", `<span style="color:#22c55e;font-weight:600;">€${data.totalAmount.toFixed(2)}</span>`)
    )}
  `;
  return emailLayout(content);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: BookingEmailRequest = await req.json();
    console.log(`[SEND-EMAIL] Received request for booking ${data.bookingId} to ${data.customerEmail}`);

    if (!data.customerEmail || !data.gymName || !data.serviceName || !data.bookingId) throw new Error("Missing required fields");
    if (!EMAIL_REGEX.test(data.customerEmail)) throw new Error("Invalid email format");
    if (data.customerEmail.length > MAX_LENGTH.email) throw new Error("Email too long");
    if (data.customerName && data.customerName.length > MAX_LENGTH.name) throw new Error("Name too long");
    if (data.gymName.length > MAX_LENGTH.gymName) throw new Error("Gym name too long");
    if (data.serviceName.length > MAX_LENGTH.serviceName) throw new Error("Service name too long");

    // Resolve language from venue's country (gym or hotel)
    const lang = await resolveLanguage(data.gymId, data.hotelId);
    console.log(`[SEND-EMAIL] Resolved language: ${lang}`);

    const managementLink = data.cancellationToken ? generateManagementLink(data.cancellationToken) : null;
    const bookingCode = data.cancellationToken ? data.cancellationToken.split("-")[0].toUpperCase() : null;

    console.log(`[SEND-EMAIL] Sending customer email to ${data.customerEmail}...`);
    const customerEmailResult = await resend.emails.send({
      from: "Massavo <noreply@massavo.com>",
      to: [data.customerEmail],
      subject: `${t("subject_booking_confirmed", lang)} – ${data.serviceName}`,
      html: generateCustomerEmail(data, managementLink, bookingCode, lang),
    });

    if (customerEmailResult.error) {
      console.error(`[SEND-EMAIL] ❌ Customer email failed:`, customerEmailResult.error);
    } else {
      console.log(`[SEND-EMAIL] ✅ Customer email sent: ${JSON.stringify(customerEmailResult.data)}`);
    }

    // Admin email always in German
    console.log(`[SEND-EMAIL] Sending admin email to ${ADMIN_EMAIL}...`);
    const adminEmailResult = await resend.emails.send({
      from: "Massavo Bookings <noreply@massavo.com>",
      to: [ADMIN_EMAIL],
      reply_to: data.customerEmail,
      subject: `Neue Buchung: ${data.serviceName} – ${data.customerName || data.customerEmail}`,
      html: generateAdminEmail(data),
    });

    if (adminEmailResult.error) {
      console.error(`[SEND-EMAIL] ❌ Admin email failed:`, adminEmailResult.error);
    } else {
      console.log(`[SEND-EMAIL] ✅ Admin email sent: ${JSON.stringify(adminEmailResult.data)}`);
    }

    return new Response(
      JSON.stringify({ success: true, customerEmail: customerEmailResult, adminEmail: adminEmailResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SEND-EMAIL] ❌ Error sending booking emails:", error);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
