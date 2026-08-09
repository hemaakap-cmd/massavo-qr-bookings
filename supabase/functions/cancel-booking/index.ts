/**
 * cancel-booking Edge Function
 * 
 * Allows customers to cancel their bookings with the following rules:
 * - Must cancel at least 24 hours before the appointment
 * - Automatically processes a full refund via Stripe
 * - Updates booking status to 'cancelled'
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailNotice, emailSignature,
  emailSubheading,
} from "../_shared/email-template.ts";
import { t, formatDateLocalized, formatTimeLocalized, formatCurrency } from "../_shared/email-i18n.ts";
import type { EmailLang } from "../_shared/email-i18n.ts";
import { resolveVenue } from "../_shared/venue.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidEmail(value: unknown): boolean {
  return typeof value === "string" && EMAIL_REGEX.test(value) && value.length <= 255;
}

function isValidToken(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  return "unknown";
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIP);
  
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (existing.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: existing.resetTime - now };
  }
  
  existing.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - existing.count, resetIn: existing.resetTime - now };
}

const CANCELLATION_HOURS = 24;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    const { email, bookingId, action, token } = await req.json();

    // Initialize Supabase with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Action: token-lookup - Secure lookup by cancellation token (no email enumeration)
    if (action === "token-lookup") {
      if (!token || !isValidToken(token)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültiger Stornierungslink" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          payment_status,
          total_amount,
          customer_name,
          customer_email,
          cancellation_token,
          gym_id, hotel_id,
          gym:gyms(name),
          hotel:hotels(name),
          service:services(name, duration_minutes)
        `)
        .eq("cancellation_token", token)
        .in("status", ["pending", "confirmed", "rescheduled"])
        .single();

      if (error || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: "Buchung nicht gefunden oder bereits storniert" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Calculate cancellation eligibility
      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const canCancel = hoursUntil >= CANCELLATION_HOURS;
      const isFuture = hoursUntil > 0;

      if (!isFuture) {
        return new Response(
          JSON.stringify({ success: false, error: "Diese Buchung liegt in der Vergangenheit" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const gymData = Array.isArray(booking.gym) ? booking.gym[0] : booking.gym;
      const hotelData = Array.isArray((booking as any).hotel) ? (booking as any).hotel[0] : (booking as any).hotel;
      const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;

      const bookingResponse = {
        id: booking.id,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        status: booking.status,
        payment_status: booking.payment_status,
        total_amount: booking.total_amount,
        customer_name: booking.customer_name,
        canCancel,
        hoursUntil: Math.floor(hoursUntil),
        gymName: hotelData?.name || gymData?.name || "Unbekannt",
        venueType: booking.hotel_id ? "hotel" : "gym",
        serviceName: serviceData?.name || "Massage",
        duration: serviceData?.duration_minutes || 0,
      };

      return new Response(
        JSON.stringify({ success: true, booking: bookingResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Action: lookup - Find bookings by email (legacy, kept for backward compatibility)
    if (action === "lookup") {
      if (!email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültige E-Mail-Adresse" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const { data: bookings, error } = await supabaseAdmin
        .from("bookings")
        .select(`
          id,
          booking_date,
          booking_time,
          status,
          payment_status,
          total_amount,
          customer_name,
          gym_id, hotel_id,
          gym:gyms(name),
          hotel:hotels(name),
          service:services(name, duration_minutes)
        `)
        .eq("customer_email", email.toLowerCase().trim())
        .in("status", ["pending", "confirmed", "rescheduled"])
        .order("booking_date", { ascending: true });

      if (error) {
        console.error("Booking lookup error:", error);
        throw new Error("Fehler beim Abrufen der Buchungen");
      }

      // Filter to only show future bookings and add cancellation eligibility
      const now = new Date();
      const eligibleBookings = (bookings || []).map((booking: any) => {
        const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
        const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        const canCancel = hoursUntil >= CANCELLATION_HOURS;
        const isFuture = hoursUntil > 0;
        
        // Handle the joined relations which could be objects or arrays
        const gymData = Array.isArray(booking.gym) ? booking.gym[0] : booking.gym;
        const hotelData = Array.isArray(booking.hotel) ? booking.hotel[0] : booking.hotel;
        const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;
        
        return {
          ...booking,
          canCancel,
          isFuture,
          hoursUntil: Math.floor(hoursUntil),
          gymName: hotelData?.name || gymData?.name || "Unbekannt",
          venueType: booking.hotel_id ? "hotel" : "gym",
          serviceName: serviceData?.name || "Massage",
          duration: serviceData?.duration_minutes || 0,
        };
      }).filter((b: any) => b.isFuture);

      return new Response(
        JSON.stringify({ success: true, bookings: eligibleBookings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Action: token-cancel - Cancel using token (more secure)
    if (action === "token-cancel") {
      if (!token || !isValidToken(token)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültiger Stornierungslink" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Fetch the booking by token with gym/service details for emails
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from("bookings")
        .select(`id, booking_date, booking_time, status, payment_status, stripe_session_id, 
                 customer_email, customer_name, total_amount, gym_id, hotel_id,
                 service:services(name, duration_minutes)`)
        .eq("cancellation_token", token)
        .single();

      if (fetchError || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: "Buchung nicht gefunden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Check if already cancelled
      if (booking.status === "cancelled") {
        return new Response(
          JSON.stringify({ success: false, error: "Diese Buchung wurde bereits storniert" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Check 24-hour cancellation window
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const now = new Date();
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < CANCELLATION_HOURS) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Stornierungen müssen mindestens ${CANCELLATION_HOURS} Stunden vor dem Termin erfolgen. Ihr Termin ist in ${Math.floor(hoursUntil)} Stunden.`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Process refund if payment was made via Stripe
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
            console.log(`Refund created: ${refundId} for booking: ${booking.id}`);
          }
        } catch (stripeError) {
          console.error("Stripe refund error:", stripeError);
        }
      }

      // Update booking status and clear cancellation token
      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "cancelled",
          payment_status: refundId ? "refunded" : booking.payment_status,
          notes: `Storniert am ${new Date().toISOString()}${refundId ? ` - Rückerstattung: ${refundId}` : ""}`,
          cancellation_token: null, // Clear token after use
        })
        .eq("id", booking.id);

      if (updateError) {
        console.error("Booking update error:", updateError);
        throw new Error("Fehler beim Stornieren der Buchung");
      }

      console.log(`Booking cancelled via token: ${booking.id} from IP: ${clientIP}`);

      // Send cancellation notification emails
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey && booking.customer_email) {
          const venue = await resolveVenue(supabaseAdmin, booking);
          const serviceData = Array.isArray(booking.service) ? booking.service[0] : booking.service;
          const customerName = booking.customer_name || "Kunde";
          const gymName = venue?.name || "Standort";
          const serviceName = serviceData?.name || "Massage";

          // Resolve language from gym's country
          const lang: EmailLang = venue?.language || "de";

          const bookingDateFormatted = formatDateLocalized(booking.booking_date, lang);
          const bookingTimeFormatted = formatTimeLocalized(booking.booking_time, lang);

          const sendEmail = async (to: string, subject: string, html: string, replyTo?: string) => {
            const body: Record<string, unknown> = { from: "Massavo <noreply@massavo.com>", to: [to], subject, html };
            if (replyTo) body.reply_to = replyTo;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
              body: JSON.stringify(body),
            });
          };

          // Customer cancellation confirmation (localized)
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

          // Admin cancellation notification (always German)
          const adminContent = `
            ${emailHeading("Stornierung eingegangen")}
            ${emailSubheading("Kundeninformation")}
            ${emailDetailTable(
              emailDetailRow("Kunde", customerName) +
              emailDetailRow("E-Mail", `<a href="mailto:${booking.customer_email}">${booking.customer_email}</a>`) +
              emailDetailRow("Service", serviceName) +
              emailDetailRow("Standort", gymName)
            )}
            ${emailNotice(`<strong>Stornierter Termin:</strong> ${bookingDateFormatted} · ${bookingTimeFormatted}<br><strong>Betrag:</strong> €${(booking.total_amount || 0).toFixed(2)}${refundId ? `<br><strong>Rückerstattung:</strong> ${refundId}` : ""}`, "error")}
          `;
          await sendEmail("info@massavo.com", `Stornierung: ${customerName} – ${serviceName}`, emailLayout(adminContent), booking.customer_email);
        }
      } catch (emailError) {
        console.error("Cancellation email error:", emailError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Buchung erfolgreich storniert",
          refunded: !!refundId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Action: cancel - Cancel a specific booking
    if (action === "cancel") {
      if (!email || !isValidEmail(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Ungültige E-Mail-Adresse" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      if (!bookingId || typeof bookingId !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "Buchungs-ID erforderlich" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Fetch the booking and verify ownership
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from("bookings")
        .select("id, booking_date, booking_time, status, payment_status, stripe_session_id, customer_email")
        .eq("id", bookingId)
        .single();

      if (fetchError || !booking) {
        return new Response(
          JSON.stringify({ success: false, error: "Buchung nicht gefunden" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      // Verify email matches
      if (booking.customer_email.toLowerCase() !== email.toLowerCase().trim()) {
        return new Response(
          JSON.stringify({ success: false, error: "E-Mail stimmt nicht mit der Buchung überein" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }

      // Check if already cancelled
      if (booking.status === "cancelled") {
        return new Response(
          JSON.stringify({ success: false, error: "Diese Buchung wurde bereits storniert" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Check 24-hour cancellation window
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const now = new Date();
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil < CANCELLATION_HOURS) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Stornierungen müssen mindestens ${CANCELLATION_HOURS} Stunden vor dem Termin erfolgen. Ihr Termin ist in ${Math.floor(hoursUntil)} Stunden.`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Process refund if payment was made via Stripe
      let refundId: string | null = null;
      if (booking.payment_status === "paid" && booking.stripe_session_id) {
        try {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2025-08-27.basil",
          });

          // Get the payment intent from the checkout session
          const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
          
          if (session.payment_intent) {
            const paymentIntentId = typeof session.payment_intent === "string" 
              ? session.payment_intent 
              : session.payment_intent.id;

            // Create full refund
            const refund = await stripe.refunds.create({
              payment_intent: paymentIntentId,
              reason: "requested_by_customer",
            });

            refundId = refund.id;
            console.log(`Refund created: ${refundId} for booking: ${bookingId}`);
          }
        } catch (stripeError) {
          console.error("Stripe refund error:", stripeError);
          // Continue with cancellation even if refund fails - admin can handle manually
        }
      }

      // Update booking status and clear cancellation token
      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          status: "cancelled",
          payment_status: refundId ? "refunded" : booking.payment_status,
          notes: `Storniert am ${new Date().toISOString()}${refundId ? ` - Rückerstattung: ${refundId}` : ""}`,
          cancellation_token: null, // Clear token after use
        })
        .eq("id", bookingId);

      if (updateError) {
        console.error("Booking update error:", updateError);
        throw new Error("Fehler beim Stornieren der Buchung");
      }

      console.log(`Booking cancelled: ${bookingId} from IP: ${clientIP}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Buchung erfolgreich storniert",
          refunded: !!refundId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ungültige Aktion" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("Cancel booking error:", error);
    // Sanitize error messages to prevent information leakage
    let userMessage = "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
    if (error instanceof Error) {
      if (error.message.includes("24 Stunden") || error.message.includes("hours before")) {
        userMessage = "Die Buchung kann nicht mehr storniert werden - die Frist ist abgelaufen.";
      } else if (error.message.includes("nicht gefunden") || error.message.includes("not found")) {
        userMessage = "Buchung nicht gefunden. Bitte überprüfen Sie Ihre Daten.";
      } else if (error.message.includes("bereits storniert") || error.message.includes("already cancelled")) {
        userMessage = "Diese Buchung wurde bereits storniert.";
      }
    }
    return new Response(
      JSON.stringify({ success: false, error: userMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
