/**
 * cancel-booking Edge Function
 *
 * Customer-facing cancellation with a 24-hour window and automatic Stripe refund.
 *
 * SECURITY (remediation item 1) — the old contract has been REMOVED:
 *
 *  - `action: "lookup"` used to return the full future-booking list (dates,
 *    times, amounts, customer name, venue) for ANY email address supplied by an
 *    anonymous caller. That is a mass booking-disclosure and customer-enumeration
 *    endpoint. It now returns 410 Gone.
 *  - `action: "cancel"` used to cancel any booking given `bookingId` + a matching
 *    email — both of which are guessable/harvestable, and the email match was
 *    checked only after the booking row was already read. It now returns 410 Gone.
 *
 * The supported contract is:
 *  - `request-access` — takes an email, ALWAYS returns the same generic response,
 *    and (only if bookings actually exist) emails the management links to that
 *    mailbox. Possession of the mailbox is the authorization factor.
 *  - `token-lookup` / `token-cancel` — require the unguessable per-booking
 *    `cancellation_token`. Cancellation is only possible with that token.
 *
 * Also hardened here: durable cross-isolate rate limiting keyed on the
 * platform-trusted client IP (never client-supplied X-Forwarded-For), an atomic
 * "claim" update so a double-submit cannot issue two Stripe refunds, and
 * sanitised error responses.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailNotice, emailSignature,
  emailSubheading, emailButton,
} from "../_shared/email-template.ts";
import { t, formatDateLocalized, formatTimeLocalized } from "../_shared/email-i18n.ts";
import type { EmailLang } from "../_shared/email-i18n.ts";
import { resolveVenue } from "../_shared/venue.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { clientErrorResponse, goneResponse, safeErrorResponse } from "../_shared/safe-error.ts";
import { enforceRateLimit, tooManyRequests } from "../_shared/rate-limit.ts";
import { getRateLimitIdentity } from "../_shared/client-identity.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidEmail(value: unknown): boolean {
  return typeof value === "string" && EMAIL_REGEX.test(value) && value.length <= 255;
}

function isValidToken(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

const CANCELLATION_HOURS = 24;
/** Canonical production origin — management links never hop through lovable.app. */
const PUBLIC_ORIGIN = "https://massavo.com";

function manageUrl(token: string): string {
  return `${PUBLIC_ORIGIN}/manage-booking?token=${encodeURIComponent(token)}`;
}

/**
 * Identical response for every `request-access` call, whether or not the mailbox
 * has bookings. This is what stops the endpoint being a customer oracle.
 */
const GENERIC_ACCESS_RESPONSE = {
  success: true,
  message:
    "Wenn zu dieser E-Mail-Adresse ein bevorstehender Termin existiert, haben wir einen Verwaltungslink an das Postfach gesendet. Bitte prüfe auch den Spam-Ordner.",
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return clientErrorResponse(corsHeaders, "Ungültige Anfrage.");
    }
    const { email, action, token } = body as Record<string, unknown>;
    const clientIdentity = getRateLimitIdentity(req);

    // ---- RETIRED, INSECURE ACTIONS ---------------------------------------
    // Kept as explicit 410s so stale clients get a clear signal instead of a
    // confusing 400, and so the old behaviour can never be reached again.
    if (action === "lookup") {
      return goneResponse(
        corsHeaders,
        "Die Terminsuche per E-Mail wurde aus Sicherheitsgründen abgeschaltet. Bitte fordere stattdessen einen Verwaltungslink an.",
      );
    }
    if (action === "cancel") {
      return goneResponse(
        corsHeaders,
        "Stornierungen sind nur noch über den persönlichen Link aus der Bestätigungs-E-Mail möglich.",
      );
    }

    // ---- ACTION: request-access ------------------------------------------
    // Generic response + management link emailed to the submitted mailbox.
    if (action === "request-access") {
      if (!isValidEmail(email)) {
        // Still generic — an invalid-format complaint is harmless, but we must
        // not distinguish "unknown address" from "known address".
        return clientErrorResponse(corsHeaders, "Ungültige E-Mail-Adresse", 400);
      }
      const normalizedEmail = (email as string).toLowerCase().trim();

      const limit = await enforceRateLimit(
        req,
        {
          action: "booking_access_request",
          subjectMax: 3,
          subjectWindowMinutes: 60,
          ipMax: 10,
          ipWindowMinutes: 60,
          blockMinutes: 60,
        },
        normalizedEmail,
        supabaseAdmin,
      );
      if (!limit.allowed) return tooManyRequests(corsHeaders, limit);

      // Any failure below is logged but NEVER reflected to the caller, so the
      // response stays byte-identical regardless of what exists in the DB.
      try {
        const { data: bookings } = await supabaseAdmin
          .from("bookings")
          .select(`
            id, booking_date, booking_time, status, cancellation_token,
            customer_name, gym_id, hotel_id,
            service:services(name)
          `)
          .eq("customer_email", normalizedEmail)
          .in("status", ["pending", "confirmed", "rescheduled"])
          .not("cancellation_token", "is", null)
          .gte("booking_date", new Date().toISOString().slice(0, 10))
          .order("booking_date", { ascending: true })
          .limit(10);

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && bookings && bookings.length > 0) {
          const first = bookings[0] as Record<string, unknown>;
          const venue = await resolveVenue(supabaseAdmin, first);
          const lang: EmailLang = venue?.language || "de";
          const customerName = (first.customer_name as string) || "Kunde";

          const rows = bookings
            .map((b: Record<string, unknown>) => {
              const service = Array.isArray(b.service) ? b.service[0] : b.service;
              const label = `${formatDateLocalized(String(b.booking_date), lang)} · ${formatTimeLocalized(String(b.booking_time), lang)}`;
              const name = (service as { name?: string } | null)?.name || "Massage";
              return `${emailDetailRow(label, name)}`;
            })
            .join("");

          const content = `
            ${emailHeading("Termin verwalten", lang)}
            ${emailGreeting(customerName, lang)}
            ${emailParagraph("du hast einen Verwaltungslink für deine Termine angefordert. Über den Button unten kannst du deine Buchung ansehen, verschieben oder stornieren.", lang)}
            ${emailDetailTable(rows)}
            <div style="text-align:center;">${emailButton("Termin verwalten", manageUrl(String(first.cancellation_token)), "primary")}</div>
            ${bookings.length > 1
              ? emailParagraph("Weitere Termine:<br>" + bookings.slice(1).map((b: Record<string, unknown>) => `<a href="${manageUrl(String(b.cancellation_token))}">${formatDateLocalized(String(b.booking_date), lang)} · ${formatTimeLocalized(String(b.booking_time), lang)}</a>`).join("<br>"), lang)
              : ""}
            ${emailNotice("Dieser Link ist persönlich. Bitte teile ihn nicht weiter.", "warning", lang)}
            ${emailSignature(lang)}
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: "Massavo <noreply@massavo.com>",
              to: [normalizedEmail],
              subject: "Massavo – Termin verwalten",
              html: emailLayout(content, undefined, lang),
            }),
          });
        }
      } catch (e) {
        console.error("[cancel-booking.request-access] suppressed:", e instanceof Error ? e.message : e);
      }

      return new Response(JSON.stringify(GENERIC_ACCESS_RESPONSE), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ---- ACTION: token-lookup -------------------------------------------
    // The token IS the authorization factor; only the holder sees details, and
    // we deliberately do not echo the customer's email address back.
    if (action === "token-lookup") {
      if (!isValidToken(token)) {
        return clientErrorResponse(corsHeaders, "Ungültiger Stornierungslink", 400);
      }

      const limit = await enforceRateLimit(
        req,
        { action: "booking_token_lookup", subjectMax: 15, subjectWindowMinutes: 60, ipMax: 40, ipWindowMinutes: 60, blockMinutes: 30 },
        String(token).slice(0, 24),
        supabaseAdmin,
      );
      if (!limit.allowed) return tooManyRequests(corsHeaders, limit);

      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select(`
          id, booking_date, booking_time, status, payment_status, total_amount,
          customer_name, gym_id, hotel_id,
          gym:gyms(name), hotel:hotels(name),
          service:services(name, duration_minutes)
        `)
        .eq("cancellation_token", token)
        .in("status", ["pending", "confirmed", "rescheduled"])
        .maybeSingle();

      if (error) {
        return safeErrorResponse(corsHeaders, "cancel-booking.token-lookup", error, "Buchung konnte nicht geladen werden.");
      }
      if (!booking) {
        return clientErrorResponse(corsHeaders, "Buchung nicht gefunden oder bereits storniert", 404);
      }

      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil <= 0) {
        return clientErrorResponse(corsHeaders, "Diese Buchung liegt in der Vergangenheit", 400);
      }

      const gymData = Array.isArray(booking.gym) ? booking.gym[0] : booking.gym;
      const hotelData = Array.isArray((booking as any).hotel) ? (booking as any).hotel[0] : (booking as any).hotel;
      const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;

      return new Response(
        JSON.stringify({
          success: true,
          booking: {
            id: booking.id,
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status,
            payment_status: booking.payment_status,
            total_amount: booking.total_amount,
            customer_name: booking.customer_name,
            canCancel: hoursUntil >= CANCELLATION_HOURS,
            hoursUntil: Math.floor(hoursUntil),
            gymName: hotelData?.name || gymData?.name || "Unbekannt",
            venueType: booking.hotel_id ? "hotel" : "gym",
            serviceName: serviceData?.name || "Massage",
            duration: serviceData?.duration_minutes || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // ---- ACTION: token-cancel -------------------------------------------
    if (action === "token-cancel") {
      if (!isValidToken(token)) {
        return clientErrorResponse(corsHeaders, "Ungültiger Stornierungslink", 400);
      }

      const limit = await enforceRateLimit(
        req,
        { action: "booking_token_cancel", subjectMax: 5, subjectWindowMinutes: 60, ipMax: 20, ipWindowMinutes: 60, blockMinutes: 60 },
        String(token).slice(0, 24),
        supabaseAdmin,
      );
      if (!limit.allowed) return tooManyRequests(corsHeaders, limit);

      const { data: booking, error: fetchError } = await supabaseAdmin
        .from("bookings")
        .select(`id, booking_date, booking_time, status, payment_status, stripe_session_id, notes,
                 customer_email, customer_name, total_amount, gym_id, hotel_id, currency,
                 service:services(name, duration_minutes)`)
        .eq("cancellation_token", token)
        .maybeSingle();

      if (fetchError) {
        return safeErrorResponse(corsHeaders, "cancel-booking.token-cancel.fetch", fetchError, "Buchung konnte nicht geladen werden.");
      }
      if (!booking) {
        return clientErrorResponse(corsHeaders, "Buchung nicht gefunden", 404);
      }
      if (booking.status === "cancelled") {
        return clientErrorResponse(corsHeaders, "Diese Buchung wurde bereits storniert", 400);
      }

      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntil = (bookingDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);

      if (hoursUntil < CANCELLATION_HOURS) {
        return clientErrorResponse(
          corsHeaders,
          `Stornierungen müssen mindestens ${CANCELLATION_HOURS} Stunden vor dem Termin erfolgen. Dein Termin ist in ${Math.floor(hoursUntil)} Stunden.`,
          400,
        );
      }

      // ATOMIC CLAIM (race protection): flip the row to cancelled and burn the
      // token in a single conditional update. Two concurrent submits mean only
      // one wins, so Stripe can never be asked to refund the same payment twice.
      // The customer's own notes are PRESERVED (appended to), not overwritten.
      const auditNote = `Storniert am ${new Date().toISOString()}`;
      const mergedNotes = booking.notes ? `${booking.notes}\n[System] ${auditNote}` : `[System] ${auditNote}`;

      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "cancelled",
          notes: mergedNotes.slice(0, 2000),
          cancellation_token: null,
        })
        .eq("cancellation_token", token)
        .neq("status", "cancelled")
        .select("id")
        .maybeSingle();

      if (claimError) {
        return safeErrorResponse(corsHeaders, "cancel-booking.claim", claimError, "Fehler beim Stornieren der Buchung.");
      }
      if (!claimed) {
        // Another request already claimed this booking.
        return new Response(
          JSON.stringify({ success: true, message: "Buchung wurde bereits storniert", refunded: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }

      // Refund AFTER the claim succeeded — exactly once per booking.
      let refundId: string | null = null;
      if (booking.payment_status === "paid" && booking.stripe_session_id) {
        try {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2025-08-27.basil",
          });
          const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
          if (session.payment_intent) {
            const paymentIntentId = typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent.id;
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
              reason: "requested_by_customer",
            });
            refundId = refund.id;
          }
        } catch (stripeError) {
          // Logged only — the customer must not see Stripe internals, and the
          // cancellation itself already succeeded.
          console.error("[cancel-booking] Stripe refund error:", stripeError instanceof Error ? stripeError.message : stripeError);
        }
      }

      if (refundId) {
        await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: "refunded",
            notes: `${mergedNotes}\n[System] Rückerstattung: ${refundId}`.slice(0, 2000),
          })
          .eq("id", booking.id);
      }

      console.log(`[cancel-booking] cancelled ${booking.id} peer=${clientIdentity} refunded=${!!refundId}`);

      // Notification emails — failures never fail the cancellation.
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && booking.customer_email) {
          const venue = await resolveVenue(supabaseAdmin, booking);
          const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;
          const customerName = booking.customer_name || "Kunde";
          const gymName = venue?.name || "Standort";
          const serviceName = serviceData?.name || "Massage";
          const lang: EmailLang = venue?.language || "de";
          const bookingDateFormatted = formatDateLocalized(booking.booking_date, lang);
          const bookingTimeFormatted = formatTimeLocalized(booking.booking_time, lang);

          const sendEmail = async (to: string, subject: string, html: string, replyTo?: string) => {
            const payload: Record<string, unknown> = { from: "Massavo <noreply@massavo.com>", to: [to], subject, html };
            if (replyTo) payload.reply_to = replyTo;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
              body: JSON.stringify(payload),
            });
          };

          const customerContent = `
            ${emailHeading(t("cancel_heading", lang), lang)}
            ${emailGreeting(customerName, lang)}
            ${emailParagraph(t("cancel_desc", lang), lang)}
            ${emailNotice(`<strong>${t("cancelled_appointment", lang)}:</strong><br>${bookingDateFormatted} · ${bookingTimeFormatted}<br>${serviceName} · ${gymName}`, "error", lang)}
            ${refundId ? emailNotice(`<strong>${t("refund_notice", lang)}:</strong><br>${t("refund_desc", lang)}`, "success", lang) : ""}
            ${emailParagraph(t("contact_support", lang), lang)}
            ${emailSignature(lang)}
          `;
          await sendEmail(booking.customer_email, `${t("subject_cancelled", lang)} – ${serviceName}`, emailLayout(customerContent, undefined, lang));

          const adminContent = `
            ${emailHeading("Stornierung eingegangen")}
            ${emailSubheading("Kundeninformation")}
            ${emailDetailTable(
              emailDetailRow("Kunde", customerName) +
              emailDetailRow("E-Mail", `<a href="mailto:${booking.customer_email}">${booking.customer_email}</a>`) +
              emailDetailRow("Service", serviceName) +
              emailDetailRow("Standort", gymName),
            )}
            ${emailNotice(`<strong>Stornierter Termin:</strong> ${bookingDateFormatted} · ${bookingTimeFormatted}<br><strong>Betrag:</strong> ${(booking.total_amount || 0).toFixed(2)} ${booking.currency || "EUR"}${refundId ? `<br><strong>Rückerstattung:</strong> ${refundId}` : ""}`, "error")}
          `;
          await sendEmail("info@massavo.com", `Stornierung: ${customerName} – ${serviceName}`, emailLayout(adminContent), booking.customer_email);
        }
      } catch (emailError) {
        console.error("[cancel-booking] email error:", emailError instanceof Error ? emailError.message : emailError);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Buchung erfolgreich storniert", refunded: !!refundId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    return clientErrorResponse(corsHeaders, "Unbekannte Aktion", 400);
  } catch (err) {
    return safeErrorResponse(corsHeaders, "cancel-booking", err, "Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
  }
});
