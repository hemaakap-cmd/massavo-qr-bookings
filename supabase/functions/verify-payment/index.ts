/**
 * verify-payment Edge Function
 * 
 * SECURITY NOTE - GUEST CHECKOUT HANDLING:
 * This function uses SUPABASE_SERVICE_ROLE_KEY to create bookings, which bypasses RLS.
 * This is INTENTIONAL for the following reasons:
 * 
 * 1. Guest checkouts (non-authenticated users) cannot have a user_id since they don't have accounts
 * 2. The bookings INSERT policy requires user_id = auth.uid(), which would reject guest bookings
 * 3. Using service role allows us to create guest bookings with user_id = NULL
 * 4. These guest bookings are ONLY accessible via the admin panel (no RLS policy matches them for regular users)
 * 
 * Security is maintained because:
 * - This endpoint validates the Stripe session ID and payment status before creating bookings
 * - Rate limiting prevents abuse (20 requests/hour per IP)
 * - Idempotency check prevents duplicate bookings via stripe_session_id
 * - Guest bookings have payment_status='paid' and valid stripe_session_id
 * - Only admins can view/manage guest bookings
 * 
 * If an authenticated user completes payment, their user_id is associated with the booking
 * and they can view it in their booking history via the standard RLS policy.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import {
  emailLayout, emailHeading, emailGreeting, emailParagraph,
  emailDetailRow, emailDetailTable, emailButton, emailNotice,
  emailSignature, emailDivider, emailSubheading,
} from "../_shared/email-template.ts";
import { t, formatDateLocalized, formatTimeLocalized, formatCurrency } from "../_shared/email-i18n.ts";
import type { EmailLang } from "../_shared/email-i18n.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = "info@massavo.com";

import { buildCorsHeaders } from "../_shared/cors.ts";

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function generateManagementLink(cancellationToken: string): string {
  return `https://massavo-qr-bookings.lovable.app/manage-booking?token=${encodeURIComponent(cancellationToken)}`;
}

interface EmailData {
  customerEmail: string;
  customerName: string | null;
  gymName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  totalAmount: number;
  bookingId: string;
  cancellationToken: string | null;
  gender: string | null;
  pregnancyStatus: string | null;
  lang: EmailLang;
}

async function sendBookingEmails(data: EmailData): Promise<boolean> {
  const lang = data.lang;
  const name = data.customerName ? sanitizeHtml(data.customerName) : t("default_customer", lang);
  const managementLink = data.cancellationToken ? generateManagementLink(data.cancellationToken) : null;
  const bookingCode = data.cancellationToken ? data.cancellationToken.split("-")[0].toUpperCase() : null;

  const customerHtml = emailLayout(`
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
      ${bookingCode ? '<p style="margin:8px 0 0;text-align:center;font-size:11px;color:#a09a94;">' + t("booking_code", lang) + ': <strong style="font-family:monospace;letter-spacing:1px;">' + bookingCode + '</strong></p>' : ""}
    ` : ""}
    ${emailNotice(t("therapist_privacy", lang), "info", lang)}
    ${emailSignature(lang)}
  `, undefined, lang);

  // Admin email always in German
  const adminHtml = emailLayout(`
    ${emailHeading("Neue Buchung eingegangen")}
    ${emailParagraph("Eine neue Buchung wurde bestätigt und bezahlt.")}
    ${emailSubheading("Kundeninformation")}
    ${emailDetailTable(
      emailDetailRow("Name", sanitizeHtml(data.customerName || "Guest")) +
      emailDetailRow("E-Mail", '<a href="mailto:' + sanitizeHtml(data.customerEmail) + '" style="color:#7a4a2a;">' + sanitizeHtml(data.customerEmail) + '</a>')
    )}
    ${emailSubheading("Buchungsdetails")}
    ${emailDetailTable(
      emailDetailRow("Buchungs-ID", '<span style="font-family:monospace;font-size:11px;">' + sanitizeHtml(data.bookingId) + '</span>') +
      emailDetailRow("Standort", sanitizeHtml(data.gymName)) +
      emailDetailRow("Service", sanitizeHtml(data.serviceName)) +
      emailDetailRow("Datum", sanitizeHtml(data.bookingDate)) +
      emailDetailRow("Uhrzeit", sanitizeHtml(data.bookingTime)) +
      emailDetailRow("Umsatz", '<span style="color:#22c55e;font-weight:600;">€' + data.totalAmount.toFixed(2) + '</span>')
    )}
  `);

  let success = false;

  // Send customer email
  try {
    console.log("[EMAIL-DIRECT] Sending customer email to", data.customerEmail);
    const customerResult = await resend.emails.send({
      from: "Massavo <noreply@massavo.com>",
      to: [data.customerEmail],
      subject: t("subject_booking_confirmed", lang) + " – " + data.serviceName,
      html: customerHtml,
    });
    if (customerResult.error) {
      console.error("[EMAIL-DIRECT] ❌ Customer email error:", customerResult.error);
    } else {
      console.log("[EMAIL-DIRECT] ✅ Customer email sent:", JSON.stringify(customerResult.data));
      success = true;
    }
  } catch (err) {
    console.error("[EMAIL-DIRECT] ❌ Customer email exception:", err);
  }

  // Send admin email
  try {
    console.log("[EMAIL-DIRECT] Sending admin email to", ADMIN_EMAIL);
    const adminResult = await resend.emails.send({
      from: "Massavo Bookings <noreply@massavo.com>",
      to: [ADMIN_EMAIL],
      reply_to: data.customerEmail,
      subject: "Neue Buchung: " + data.serviceName + " – " + (data.customerName || data.customerEmail),
      html: adminHtml,
    });
    if (adminResult.error) {
      console.error("[EMAIL-DIRECT] ❌ Admin email error:", adminResult.error);
    } else {
      console.log("[EMAIL-DIRECT] ✅ Admin email sent:", JSON.stringify(adminResult.data));
    }
  } catch (err) {
    console.error("[EMAIL-DIRECT] ❌ Admin email exception:", err);
  }

  return success;
}

// Validation helpers
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

// Rate limiting (same pattern as create-payment)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // Higher limit for verify since it's called after payment
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }
  
  const userAgent = req.headers.get("user-agent") || "unknown";
  const origin = req.headers.get("origin") || "unknown";
  return `fallback-${userAgent.slice(0, 50)}-${origin}`;
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIP);
  
  // Clean up expired entries periodically
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

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);
    
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for verify-payment from IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Too many verification requests. Please try again later.",
          retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        }), 
        {
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000))
          },
          status: 429,
        }
      );
    }

    const { sessionId } = await req.json();

    // Validate session ID format
    if (!sessionId || typeof sessionId !== "string") {
      throw new Error("Session ID is required");
    }

    // Stripe session IDs start with "cs_"
    if (!sessionId.startsWith("cs_")) {
      throw new Error("Invalid session ID format");
    }

    // Limit session ID length to prevent abuse
    if (sessionId.length > 200) {
      throw new Error("Session ID too long");
    }

    // Determine the correct Stripe key based on the gym's country
    // First, try to get gymId from metadata to look up country-specific key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // We don't yet know which country/Stripe account owns this session.
    // Try each configured Stripe secret key (default + per-country) until we
    // find the account that issued the checkout session.
    const { data: countriesList } = await supabaseAdmin
      .from("countries")
      .select("stripe_secret_key_name");
    const candidateKeyNames = Array.from(new Set([
      "STRIPE_SECRET_KEY",
      ...((countriesList || [])
        .map((c: any) => c.stripe_secret_key_name)
        .filter((n: any): n is string => typeof n === "string" && n.length > 0)),
    ]));

    let stripe: Stripe | null = null;
    let session: any = null;
    let lastRetrieveError: any = null;
    for (const keyName of candidateKeyNames) {
      const k = Deno.env.get(keyName);
      if (!k) continue;
      try {
        const s = new Stripe(k, { apiVersion: "2025-08-27.basil" });
        const sess = await s.checkout.sessions.retrieve(sessionId, {
          expand: ["line_items", "customer"],
        });
        stripe = s;
        session = sess;
        break;
      } catch (e) {
        lastRetrieveError = e;
      }
    }

    if (!session || !stripe) {
      console.error("Could not retrieve Stripe session with any configured key", lastRetrieveError);
      throw new Error("Payment session not found");
    }

    // Verify payment was successful
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Payment not completed",
          status: session.payment_status 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Extract metadata from the session
    const metadata = session.metadata || {};
    const serviceId = metadata.serviceId;
    const gymName = metadata.gymName || "Unknown Gym";
    const gymIdFromMeta = metadata.gymId || "";
    const hotelIdFromMeta = metadata.hotelId || "";
    const hotelNameFromMeta = metadata.hotelName || "";
    const venueType: "gym" | "hotel" = (metadata.venueType === "hotel" ? "hotel" : "gym");
    const timeSlot = metadata.timeSlot || "Not specified";
    const bookingDateFromMeta = metadata.bookingDate || "";

    // Validate serviceId from metadata
    if (!serviceId || !isValidUUID(serviceId)) {
      throw new Error("Invalid service ID in session metadata");
    }

    // Get customer email from session
    const customerEmail = session.customer_details?.email || 
                         (typeof session.customer === "object" ? session.customer?.email : null) ||
                         session.customer_email;

    if (!customerEmail) {
      throw new Error("Customer email not found in session");
    }

    // supabaseAdmin already initialized above for Stripe key lookup

    // Check if booking already exists for this session (idempotency)
    const { data: existingBooking } = await supabaseAdmin
      .from("bookings")
      .select("id, cancellation_token, customer_email, customer_name, booking_date, booking_time, total_amount, service_id, gym_id, gender, pregnancy_status")
      .eq("stripe_session_id", sessionId)
      .single();

    if (existingBooking) {
      console.log(`Booking already exists for session: ${sessionId} - returning existing (no duplicate email)`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          bookingId: existingBooking.id,
          cancellationToken: existingBooking.cancellation_token,
          message: "Booking already confirmed" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Resolve venue id (gym or hotel) from metadata
    let gymId: string | null = null;
    let hotelId: string | null = null;

    if (venueType === "hotel") {
      if (hotelIdFromMeta && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hotelIdFromMeta)) {
        const { data: hotelRow } = await supabaseAdmin
          .from("hotels").select("id").eq("id", hotelIdFromMeta).eq("is_active", true).single();
        if (hotelRow) hotelId = hotelRow.id;
      }
      if (!hotelId) throw new Error("Hotel not found for booking");
    } else {
    
    if (gymIdFromMeta && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gymIdFromMeta)) {
      // Verify the gym ID exists and is active
      const { data: gym, error: gymError } = await supabaseAdmin
        .from("gyms")
        .select("id")
        .eq("id", gymIdFromMeta)
        .eq("is_active", true)
        .single();
      
      if (!gymError && gym) {
        gymId = gym.id;
      }
    }
    
    if (!gymId) {
      const { data: gym, error: gymError } = await supabaseAdmin
        .from("gyms")
        .select("id")
        .eq("name", gymName)
        .eq("is_active", true)
        .single();

      if (gymError || !gym) {
        console.error("Gym lookup error:", gymError);
        const { data: fallbackGym } = await supabaseAdmin
          .from("gyms")
          .select("id")
          .eq("is_active", true)
          .limit(1)
          .single();
        
        if (!fallbackGym) {
          throw new Error("No active gym found");
        }
        gymId = fallbackGym.id;
      } else {
        gymId = gym.id;
      }
    }
    } // end gym branch

    // Use actual booking date from metadata, fall back to today
    const bookingDate = bookingDateFromMeta && /^\d{4}-\d{2}-\d{2}$/.test(bookingDateFromMeta) 
      ? bookingDateFromMeta 
      : new Date().toISOString().split("T")[0];
    const bookingTime = timeSlot.includes(":") ? timeSlot : "12:00";

    // Get service price from the session
    const totalAmount = session.amount_total ? session.amount_total / 100 : 0;

    // Try to get authenticated user from the request (if available)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const supabaseAuth = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        );
        
        const token = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
        
        if (!userError && userData?.user?.id) {
          userId = userData.user.id;
          console.log(`Authenticated user found for booking: ${userId}`);
        }
      } catch (authError) {
        console.log("No authenticated user for this booking (guest checkout)");
      }
    }

    // SECURITY: Create booking using atomic function to prevent duplicates
    // Uses advisory locks + unique index for race-condition-safe booking creation
    const isGuestCheckout = userId === null;
    
    if (isGuestCheckout) {
      console.log(`Creating guest booking for session: ${sessionId} (email: ${customerEmail})`);
    }

    // Generate unique cancellation token for secure booking management
    const cancellationToken = crypto.randomUUID();
    
    // Use atomic booking function (gym or hotel variant)
    const { data: bookingId, error: bookingError } = venueType === "hotel"
      ? await supabaseAdmin.rpc("create_hotel_booking_atomic", {
          p_hotel_id: hotelId,
          p_service_id: serviceId,
          p_booking_date: bookingDate,
          p_booking_time: bookingTime,
          p_customer_email: customerEmail,
          p_customer_name: metadata.clientName || session.customer_details?.name || null,
          p_total_amount: totalAmount,
          p_payment_status: "paid",
          p_stripe_session_id: sessionId,
          p_user_id: userId,
          p_cancellation_token: cancellationToken,
        })
      : await supabaseAdmin.rpc("create_booking_atomic", {
          p_gym_id: gymId,
          p_service_id: serviceId,
          p_booking_date: bookingDate,
          p_booking_time: bookingTime,
          p_customer_email: customerEmail,
          p_customer_name: metadata.clientName || session.customer_details?.name || null,
          p_total_amount: totalAmount,
          p_payment_status: "paid",
          p_stripe_session_id: sessionId,
          p_user_id: userId,
          p_cancellation_token: cancellationToken,
        });

    if (bookingError) {
      console.error("Booking creation error:", bookingError);
      // Handle specific error types
      if (bookingError.message?.includes("DUPLICATE_BOOKING") || bookingError.message?.includes("SLOT_UNAVAILABLE")) {
        // Check if it's the same stripe session (idempotent retry) or a different customer
        let existingBySlotQuery = supabaseAdmin
          .from("bookings")
          .select("id, cancellation_token, stripe_session_id")
          .eq("booking_date", bookingDate)
          .eq("booking_time", bookingTime)
          .not("status", "in", "(cancelled,rescheduled)");
        existingBySlotQuery = venueType === "hotel"
          ? existingBySlotQuery.eq("hotel_id", hotelId as string)
          : existingBySlotQuery.eq("gym_id", gymId as string);
        const { data: existingBySlot } = await existingBySlotQuery.single();
        
        if (existingBySlot) {
          // Same Stripe session = idempotent retry (safe to return success)
          if (existingBySlot.stripe_session_id === sessionId) {
            console.log(`Idempotent retry - returning existing booking: ${existingBySlot.id}`);
            return new Response(
              JSON.stringify({ 
                success: true, 
                bookingId: existingBySlot.id,
                cancellationToken: existingBySlot.cancellation_token,
                message: "Booking already confirmed for this slot" 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
            );
          }

          // DIFFERENT customer took the slot → refund the second payment automatically
          console.warn(`[CONFLICT] Slot already taken by booking ${existingBySlot.id}. Refunding session ${sessionId}`);

          // Log conflict event
          try {
            await supabaseAdmin.from("booking_events").insert({
              event_type: "conflict_blocked",
              gym_id: venueType === "hotel" ? null : gymId,
              booking_date: bookingDate,
              booking_time: bookingTime,
              customer_email: customerEmail,
              customer_name: session.customer_details?.name || null,
              details: {
                reason: "duplicate_slot_post_payment",
                blocked_session_id: sessionId,
                existing_booking_id: existingBySlot.id,
                refund_initiated: true,
              },
              severity: "warning",
            });
          } catch (logErr) {
            console.error("[CONFLICT] Failed to log conflict event:", logErr);
          }

          // Initiate automatic Stripe refund
          try {
            const paymentIntentId = session.payment_intent;
            if (paymentIntentId && typeof paymentIntentId === "string") {
              const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: "duplicate",
              });
              console.log(`[CONFLICT] ✅ Refund created: ${refund.id} for payment_intent ${paymentIntentId}`);
            } else {
              console.error("[CONFLICT] No payment_intent found on session for refund");
            }
          } catch (refundErr) {
            console.error("[CONFLICT] ❌ Refund failed:", refundErr);
            // Even if refund fails, still notify the customer
          }

          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Dieser Termin wurde soeben von einem anderen Kunden gebucht. Ihre Zahlung wird automatisch erstattet. Bitte buchen Sie einen anderen Termin.",
              slotTaken: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
          );
        }
      }
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    // Fetch the created booking for email data
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, cancellation_token")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      throw new Error("Booking created but could not be retrieved");
    }

    // Update all captured client details from checkout metadata
    const updateFields: Record<string, unknown> = {};

    if (metadata.policyAccepted === "true") {
      updateFields.policy_accepted = true;
      updateFields.policy_accepted_at = metadata.policyAcceptedAt || new Date().toISOString();
    }

    if (metadata.clientAge && /^\d+$/.test(metadata.clientAge)) {
      const parsedAge = Number(metadata.clientAge);
      if (parsedAge >= 16 && parsedAge <= 120) {
        updateFields.client_age = parsedAge;
      }
    }

    if (metadata.clientPhone && metadata.clientPhone !== "") {
      updateFields.client_phone = metadata.clientPhone;
    }

    if (metadata.clientAddress && metadata.clientAddress !== "") {
      updateFields.client_address = metadata.clientAddress;
    }

    if (metadata.healthConfirmed === "true" || metadata.healthConfirmed === "false") {
      updateFields.health_confirmed = metadata.healthConfirmed === "true";
    }

    if (metadata.salutation && metadata.salutation !== "") {
      updateFields.salutation = metadata.salutation;
    }

    if (metadata.gender && ["male", "female"].includes(metadata.gender)) {
      updateFields.gender = metadata.gender;
    }

    if (metadata.dateOfBirth && metadata.dateOfBirth !== "") {
      // Accept both DD.MM.YYYY (from form) and YYYY-MM-DD
      const ddmmyyyy = metadata.dateOfBirth.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      const yyyymmdd = metadata.dateOfBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);

      if (ddmmyyyy) {
        updateFields.date_of_birth = `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
      } else if (yyyymmdd) {
        updateFields.date_of_birth = metadata.dateOfBirth;
      }
    }

    if (metadata.pregnancyStatus && metadata.pregnancyStatus !== "") {
      updateFields.pregnancy_status = metadata.pregnancyStatus;
    }

    if (metadata.notes && metadata.notes !== "") {
      updateFields.notes = metadata.notes;
    }

    if (metadata.communicationPreference && metadata.communicationPreference !== "") {
      updateFields.communication_preference = metadata.communicationPreference;
    }

    // Steuer- & GoBD-Felder (Kleinunternehmer §19 UStG):
    // Brutto = Netto, keine USt. service_name_snapshot aus DB (Service-Name).
    try {
      const finalPrice = Number(metadata.finalPrice ?? totalAmount);
      if (Number.isFinite(finalPrice) && finalPrice > 0) {
        updateFields.net_amount = finalPrice;
        updateFields.tax_amount = 0;
        updateFields.tax_rate = 0;
        updateFields.tax_regime = "kleinunternehmer_19_ustg";
        updateFields.currency = (session.currency || "eur").toUpperCase();
      }
      const { data: svc } = await supabaseAdmin
        .from("services")
        .select("name, price")
        .eq("id", serviceId)
        .maybeSingle();
      if (svc) {
        updateFields.service_name_snapshot = svc.name;
        updateFields.service_price_snapshot = svc.price;
      }
    } catch (taxErr) {
      console.error("[TAX] failed to populate tax/snapshot fields:", taxErr);
    }

    if (Object.keys(updateFields).length > 0) {
      await supabaseAdmin.from("bookings").update(updateFields).eq("id", booking.id);
    }

    console.log(`Booking created successfully: ${booking.id} for session: ${sessionId} (user: ${userId || 'guest'})`);

    // Smart auto-assign therapist based on weekly schedules + load balancing
    try {
      if (venueType === "hotel") {
        // Therapist assignment for hotel: check therapist_weekly_schedules.hotel_id
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const bookingDayOfWeek = dayNames[new Date(bookingDate + 'T00:00:00').getDay()];
        const { data: weeklySchedules } = await supabaseAdmin
          .from("therapist_weekly_schedules")
          .select("therapist_id, start_time, end_time")
          .eq("hotel_id", hotelId as string)
          .eq("day_of_week", bookingDayOfWeek)
          .eq("is_active", true);
        const eligible = (weeklySchedules || []).filter((s: any) => bookingTime >= s.start_time && bookingTime < s.end_time);
        if (eligible.length > 0) {
          const selectedTherapistId = eligible[0].therapist_id;
          await supabaseAdmin.from("bookings").update({ therapist_id: selectedTherapistId }).eq("id", booking.id);
          console.log(`[THERAPIST-ASSIGN] ✅ Hotel-assigned therapist ${selectedTherapistId} to booking ${booking.id}`);
        } else {
          console.log(`[THERAPIST-ASSIGN] No therapist for hotel ${hotelId} on ${bookingDayOfWeek}`);
        }
      } else {
      // 1. Determine day of week from booking date
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const bookingDayOfWeek = dayNames[new Date(bookingDate + 'T00:00:00').getDay()];

      // 2. Find all therapists scheduled for this gym on this day of week
      const { data: weeklySchedules } = await supabaseAdmin
        .from("therapist_weekly_schedules")
        .select("therapist_id, start_time, end_time")
        .eq("gym_id", gymId)
        .eq("day_of_week", bookingDayOfWeek)
        .eq("is_active", true);

      if (weeklySchedules && weeklySchedules.length > 0) {
        // 3. Filter to therapists whose hours cover the booking time
        let eligibleTherapists = weeklySchedules.filter(s => {
          return bookingTime >= s.start_time && bookingTime < s.end_time;
        });

        if (eligibleTherapists.length > 0) {
          let selectedTherapistId: string;

          if (eligibleTherapists.length === 1) {
            selectedTherapistId = eligibleTherapists[0].therapist_id;
          } else {
            // 4. Load balancing: pick the therapist with fewest bookings today
            const therapistIds = eligibleTherapists.map(t => t.therapist_id);
            const { data: todayBookings } = await supabaseAdmin
              .from("bookings")
              .select("therapist_id")
              .eq("booking_date", bookingDate)
              .in("therapist_id", therapistIds)
              .not("status", "in", "(cancelled,rescheduled)");

            const countMap = new Map<string, number>();
            therapistIds.forEach(id => countMap.set(id, 0));
            (todayBookings || []).forEach((b: any) => {
              countMap.set(b.therapist_id, (countMap.get(b.therapist_id) || 0) + 1);
            });

            // Pick therapist with lowest count
            selectedTherapistId = therapistIds.reduce((best, id) =>
              (countMap.get(id) || 0) < (countMap.get(best) || 0) ? id : best
            );
            console.log(`[THERAPIST-ASSIGN] Load balancing: ${JSON.stringify(Object.fromEntries(countMap))}`);
          }

          const { error: assignErr } = await supabaseAdmin
            .from("bookings")
            .update({ therapist_id: selectedTherapistId })
            .eq("id", booking.id);

          if (assignErr) {
            console.error(`[THERAPIST-ASSIGN] Failed: ${assignErr.message}`);
          } else {
            console.log(`[THERAPIST-ASSIGN] ✅ Smart-assigned therapist ${selectedTherapistId} to booking ${booking.id}`);
          }
        } else {
          console.log(`[THERAPIST-ASSIGN] No therapist covers time ${bookingTime} on ${bookingDayOfWeek}`);
        }
      } else {
        // Fallback: check legacy therapist_assignments table
        const { data: legacyAssignment } = await supabaseAdmin
          .from("therapist_assignments")
          .select("therapist_id")
          .eq("gym_id", gymId)
          .eq("assignment_date", bookingDate)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (legacyAssignment?.therapist_id) {
          await supabaseAdmin.from("bookings").update({ therapist_id: legacyAssignment.therapist_id }).eq("id", booking.id);
          console.log(`[THERAPIST-ASSIGN] ✅ Legacy-assigned therapist ${legacyAssignment.therapist_id} to booking ${booking.id}`);
        } else {
          console.log(`[THERAPIST-ASSIGN] No schedule found for gym ${gymId} on ${bookingDayOfWeek} (${bookingDate})`);
        }
      }
      } // end gym branch
    } catch (assignError) {
      console.error(`[THERAPIST-ASSIGN] Error during auto-assignment:`, assignError);
    }

    // Get service name for email
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .single();

    const serviceName = service?.name || "Massage Service";

    // Resolve email language from gym's country
    let emailLang: EmailLang = "de";
    try {
      const { data: venueLangData } = venueType === "hotel"
        ? await supabaseAdmin.from("hotels").select("country:countries(default_language)").eq("id", hotelId as string).maybeSingle()
        : await supabaseAdmin.from("gyms").select("country:countries(default_language)").eq("id", gymId as string).maybeSingle();
      const countryData = Array.isArray((venueLangData as any)?.country) ? (venueLangData as any).country[0] : (venueLangData as any)?.country;
      const resolvedLang = countryData?.default_language;
      if (resolvedLang === "ar" || resolvedLang === "en" || resolvedLang === "de") emailLang = resolvedLang as EmailLang;
    } catch (e) { console.error("[LANG] Resolution failed:", e); }

    // Send booking confirmation emails (awaited to prevent runtime termination)
    const customerName = metadata.clientName || session.customer_details?.name || null;
    
    console.log(`[EMAIL-DIRECT] Sending confirmation for booking ${booking.id} to ${customerEmail} (lang: ${emailLang})`);
    
    const emailSent = await sendBookingEmails({
      customerEmail,
      customerName,
      gymName: venueType === "hotel" ? (hotelNameFromMeta || gymName) : gymName,
      serviceName,
      bookingDate,
      bookingTime,
      totalAmount,
      bookingId: booking.id,
      cancellationToken: booking.cancellation_token,
      gender: metadata.gender || null,
      pregnancyStatus: metadata.pregnancyStatus || null,
      lang: emailLang,
    });

    if (!emailSent) {
      console.error(`[EMAIL-DIRECT] ❌ CRITICAL: Failed to send confirmation email for booking ${booking.id}`);
      try {
        await supabaseAdmin.from("booking_events").insert({
          event_type: "email_failed",
          booking_id: booking.id,
          gym_id: venueType === "hotel" ? null : gymId,
          booking_date: bookingDate,
          booking_time: bookingTime,
          customer_email: customerEmail,
          customer_name: customerName,
          details: { reason: "confirmation_email_failed_direct_resend" },
          severity: "error",
        });
      } catch (logError) {
        console.error("[EMAIL-DIRECT] Failed to log email failure:", logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        bookingId: booking.id,
        cancellationToken: booking.cancellation_token,
        message: "Booking confirmed successfully" 
      }),
      {
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(rateLimit.remaining)
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    // Sanitize error messages to prevent information leakage
    let userMessage = "Payment verification failed. Please contact support.";
    if (error instanceof Error) {
      if (error.message.includes("Invalid") || error.message.includes("Session ID")) {
        userMessage = "Invalid payment session. Please try again.";
      } else if (error.message.includes("not found")) {
        userMessage = "Payment not found. Please contact support.";
      } else if (error.message.includes("Rate limit")) {
        userMessage = "Too many requests. Please try again later.";
      }
    }
    return new Response(
      JSON.stringify({ success: false, error: userMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
