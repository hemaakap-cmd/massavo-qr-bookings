import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailNotice,
  emailSignature, emailSubheading, emailDivider,
} from "../_shared/email-template.ts";
import { t, formatDateLocalized, formatTimeLocalized } from "../_shared/email-i18n.ts";
import type { EmailLang } from "../_shared/email-i18n.ts";
import { resolveVenue, checkVenueSlotAvailability } from "../_shared/venue.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_EMAIL = "info@massavo.com";
const RESCHEDULE_HOURS_MINIMUM = 24;

function isValidToken(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIP);
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) rateLimitMap.delete(key);
    }
  }
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX) return false;
  existing.count++;
  return true;
}

interface ManageBookingRequest {
  token: string;
  action: "lookup" | "reschedule";
  newDate?: string;
  newTime?: string;
  /** Required for `reschedule`: must match the booking's customer_email. */
  customerEmail?: string;
}

/** Constant-time-ish email comparison (case-insensitive, trimmed). */
function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na.length !== nb.length) return false;
  // Length-equal comparison; avoid short-circuit timing leaks.
  let diff = 0;
  for (let i = 0; i < na.length; i++) diff |= na.charCodeAt(i) ^ nb.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ success: false, error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ManageBookingRequest = await req.json();
    const { token, action } = body;

    if (!token || !isValidToken(token)) {
      return new Response(
        JSON.stringify({ success: false, error: "Ungültiger Verwaltungslink" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ─── LOOKUP ───
    if (action === "lookup") {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select(`
          id, booking_date, booking_time, status, payment_status, total_amount,
          customer_name, customer_email, gym_id, hotel_id, service_id, therapist_id,
          cancellation_token,
          gym:gyms(id, name, address),
          hotel:hotels(id, name, address),
          service:services(id, name, duration_minutes),
          therapist:therapists(id, name)
        `)
        .eq("cancellation_token", token)
        .in("status", ["pending", "confirmed", "rescheduled"])
        .maybeSingle();

      if (error || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: "Buchung nicht gefunden oder bereits storniert" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil <= 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Diese Buchung liegt in der Vergangenheit" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const gymData = Array.isArray(booking.gym) ? booking.gym[0] : booking.gym;
      const hotelData = Array.isArray((booking as any).hotel) ? (booking as any).hotel[0] : (booking as any).hotel;
      const venueData = booking.hotel_id ? hotelData : gymData;
      const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;
      const therapistData = Array.isArray(booking.therapist) ? booking.therapist[0] : booking.therapist;

      return new Response(
        JSON.stringify({
          success: true,
          booking: {
            id: booking.id,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status,
            total_amount: booking.total_amount,
            customer_name: booking.customer_name,
            canModify: hoursUntil >= RESCHEDULE_HOURS_MINIMUM,
            hoursUntil: Math.floor(hoursUntil),
            gym_id: gymData?.id || booking.gym_id,
            hotel_id: hotelData?.id || booking.hotel_id,
            venueType: booking.hotel_id ? "hotel" : "gym",
            gymName: venueData?.name || "Unbekannt",
            gymAddress: venueData?.address || "",
            service_id: serviceData?.id || booking.service_id,
            serviceName: serviceData?.name || "Massage",
            serviceDuration: serviceData?.duration_minutes || 0,
            therapistName: therapistData?.name || null,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── RESCHEDULE ───
    if (action === "reschedule") {
      const { newDate, newTime, customerEmail } = body;

      if (!newDate || !newTime) {
        return new Response(
          JSON.stringify({ success: false, error: "Neues Datum und Uhrzeit erforderlich" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Defense-in-depth: the cancellation_token alone is sent in plain email
      // URLs and is a hijack risk if leaked. For reschedule (which can't be
      // un-done without re-payment), require the caller to also confirm the
      // booking's email address. The email field is REQUIRED.
      if (!customerEmail || typeof customerEmail !== "string" || !EMAIL_REGEX.test(customerEmail)) {
        return new Response(
          JSON.stringify({ success: false, error: "Bitte bestätige zur Sicherheit die E-Mail-Adresse, mit der gebucht wurde." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Date format validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültiges Datumsformat" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!/^\d{2}:\d{2}$/.test(newTime)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültiges Zeitformat" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch booking by token
      const { data: booking, error: fetchError } = await supabase
        .from("bookings")
        .select(`
          id, booking_date, booking_time, status, customer_name, customer_email,
          gym_id, hotel_id, service_id, total_amount,
          service:services(name, duration_minutes)
        `)
        .eq("cancellation_token", token)
        .in("status", ["pending", "confirmed", "rescheduled"])
        .maybeSingle();

      if (fetchError || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: "Buchung nicht gefunden" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Email confirmation gate (token + email both required for reschedule).
      // Returns the same generic message for "no booking" vs "wrong email" so
      // we don't disclose which one failed.
      if (!emailsMatch(customerEmail, booking.customer_email)) {
        // Forensic log — useful for spotting token-leak abuse.
        await supabase.from("booking_events").insert({
          event_type: "reschedule_email_mismatch",
          gym_id: booking.gym_id,
          hotel_id: booking.hotel_id,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          customer_email: booking.customer_email,
          details: { provided_email_prefix: customerEmail.split("@")[0]?.slice(0, 3) ?? "", ip: clientIP },
          severity: "warning",
        }).then(() => {}, () => {}); // never let logging failures break the user flow
        return new Response(
          JSON.stringify({ success: false, error: "Sicherheitsprüfung fehlgeschlagen. Bitte überprüfe die E-Mail-Adresse, mit der du gebucht hast." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check modification window
      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < RESCHEDULE_HOURS_MINIMUM) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Umbuchungen müssen mindestens ${RESCHEDULE_HOURS_MINIMUM} Stunden vor dem Termin erfolgen.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check new date is in the future
      const newDateTime = new Date(`${newDate}T${newTime}`);
      if (newDateTime <= now) {
        return new Response(
          JSON.stringify({ success: false, error: "Der neue Termin muss in der Zukunft liegen" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;
      const serviceDuration = serviceData?.duration_minutes || 25;

      // Resolve venue (gym or hotel) and check slot availability with the right RPC
      const venue = await resolveVenue(supabase, booking);
      if (!venue) {
        return new Response(
          JSON.stringify({ success: false, error: "Standort nicht gefunden" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const isAvailable = await checkVenueSlotAvailability(supabase, venue, newDate, newTime, serviceDuration);

      if (!isAvailable) {
        return new Response(
          JSON.stringify({ success: false, error: "Der gewählte Zeitraum ist leider nicht mehr verfügbar" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store old values for logging/email
      const oldDate = booking.booking_date;
      const oldTime = booking.booking_time;

      // Update booking
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          booking_date: newDate,
          booking_time: newTime,
          status: "rescheduled",
          notes: `Umgebucht am ${now.toISOString()} | Alter Termin: ${oldDate} ${oldTime}`,
        })
        .eq("id", booking.id);

      if (updateError) {
        console.error("Booking update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Fehler beim Aktualisieren der Buchung" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send emails
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const customerName = booking.customer_name ? sanitizeHtml(booking.customer_name) : "Kunde";
        const gymName = sanitizeHtml(venue.name || "Standort");
        const serviceName = sanitizeHtml(serviceData?.name || "Massage");

        const lang: EmailLang = venue.language;

        const sendEmail = async (to: string, subject: string, html: string, replyTo?: string) => {
          const body: Record<string, unknown> = { from: "Massavo <noreply@massavo.com>", to: [to], subject, html };
          if (replyTo) body.reply_to = replyTo;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify(body),
          });
        };

        // Customer confirmation (localized)
        const customerContent = `
          ${emailHeading(t("reschedule_heading", lang), lang)}
          ${emailGreeting(customerName, lang)}
          ${emailParagraph(t("reschedule_desc", lang), lang)}
          ${emailNotice(`<strong>${t("old_appointment", lang)}:</strong><br>${formatDateLocalized(oldDate, lang)} · ${formatTimeLocalized(oldTime, lang)}`, "error", lang)}
          ${emailNotice(`<strong>${t("new_appointment", lang)}:</strong><br>${formatDateLocalized(newDate, lang)} · ${formatTimeLocalized(newTime, lang)}`, "success", lang)}
          ${emailSubheading(t("label_details", lang), lang)}
          ${emailDetailTable(
            emailDetailRow(t("label_service", lang), serviceName, lang) +
            emailDetailRow(t("label_location", lang), gymName, lang)
          )}
          ${emailParagraph(t("contact_support", lang), lang)}
          ${emailSignature(lang)}
        `;
        await sendEmail(
          booking.customer_email,
          `${t("subject_rescheduled", lang)} – ${serviceName}`,
          emailLayout(customerContent, undefined, lang)
        );

        // Admin notification (always German)
        const adminContent = `
          ${emailHeading("Termin umgebucht")}
          ${emailSubheading("Kundeninformation")}
          ${emailDetailTable(
            emailDetailRow("Kunde", customerName) +
            emailDetailRow("E-Mail", '<a href="mailto:' + sanitizeHtml(booking.customer_email) + '">' + sanitizeHtml(booking.customer_email) + '</a>') +
            emailDetailRow("Service", serviceName) +
            emailDetailRow("Standort", gymName)
          )}
          ${emailNotice(`<strong>Alter Termin:</strong> ${formatDateLocalized(oldDate, "de")} · ${formatTimeLocalized(oldTime, "de")}`, "error")}
          ${emailNotice(`<strong>Neuer Termin:</strong> ${formatDateLocalized(newDate, "de")} · ${formatTimeLocalized(newTime, "de")}`, "success")}
        `;
        await sendEmail(
          ADMIN_EMAIL,
          `Umbuchung: ${customerName} – ${serviceName}`,
          emailLayout(adminContent),
          booking.customer_email
        );
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Termin erfolgreich umgebucht",
          newDate,
          newTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ungültige Aktion" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Manage booking error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
