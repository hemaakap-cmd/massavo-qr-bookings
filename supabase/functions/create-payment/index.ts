import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { buildCorsHeaders, getRedirectOrigin } from "../_shared/cors.ts";

function getSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Service ID is required") || message.includes("Invalid service ID")) return "Invalid service selection. Please try again.";
  if (message.includes("Invalid email")) return "Invalid email format. Please check your email address.";
  if (message.includes("Age must be")) return "Invalid age. Please enter a valid age between 16 and 120.";
  if (message.includes("Invalid service selected") || message.includes("Service not found")) return "Selected service is not available. Please choose another service.";
  if (message.includes("Rate limit")) return "Too many requests. Please try again later.";
  return "Payment processing failed. Please try again later.";
}

// --- Intensity pricing logic (mirrors frontend) ---
function getZoneExtra(level: number): number {
  if (level <= 3) return 0;
  if (level <= 5) return 0.5;
  if (level <= 7) return 1;
  if (level <= 9) return 1.5;
  return 2;
}

const DEEP_TISSUE_UPGRADE_PRICE = 9;

// Hard bounds on payment amounts. Defense against:
//   - Bad data in services.price (NaN, negative, absurd values).
//   - get_effective_service_price RPC returning unexpected output.
//   - Surcharge calculation overflows.
// Bounds are denominated in the venue's currency unit (e.g. EUR for DE).
// MIN/MAX are deliberately wide to accommodate future high-end services and
// any reasonable currency without per-country tuning. If a row legitimately
// needs to exceed MAX, raise this constant — do not bypass.
const MIN_PRICE_UNITS = 5;        // €5 / SAR 5 etc. — guards against zero/negative
const MAX_PRICE_UNITS = 5000;     // €5000 — far above any real massage
const MAX_SURCHARGE_UNITS = 100;  // intensity + deep-tissue can't exceed this

function calculateServerSurcharge(
  bodyAreas: Array<{ code: string; painIntensity: number }> | undefined,
  deepTissueUpgradeActive: boolean
): number {
  if (!bodyAreas || bodyAreas.length === 0) return 0;
  if (deepTissueUpgradeActive) {
    // Validate: upgrade only allowed if 3+ zones >= 7
    const highCount = bodyAreas.filter(z => z.painIntensity >= 7).length;
    if (highCount >= 3) return DEEP_TISSUE_UPGRADE_PRICE;
    // If not eligible, fall through to individual
  }
  return bodyAreas.reduce((sum, z) => sum + getZoneExtra(z.painIntensity || 0), 0);
}

// --- Validation ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUUID(v: unknown): boolean { return typeof v === "string" && UUID_REGEX.test(v); }
function isValidEmail(v: unknown): boolean { return typeof v === "string" && EMAIL_REGEX.test(v) && v.length <= 255; }
function sanitizeString(v: unknown, max: number): string { return typeof v === "string" ? v.trim().slice(0, max) : ""; }

interface ValidatedInput {
  serviceId: string;
  therapistName: string;
  timeSlot: string;
  bookingDate: string;
  gymName: string;
  gymId: string;
  hotelId: string;
  hotelName: string;
  venueType: "gym" | "hotel";
  customerEmail: string;
  clientName: string;
  clientAge: number | null;
  clientPhone: string;
  clientAddress: string;
  healthConfirmed: boolean;
  dateOfBirth: string;
  salutation: string;
  gender: string;
  pregnancyStatus: string;
  notes: string;
  communicationPreference: string;
  selectedBodyAreas: Array<{ code: string; label?: string; painIntensity: number }>;
  deepTissueUpgradeActive: boolean;
}

function validatePaymentInput(body: Record<string, unknown>): ValidatedInput {
  const { serviceId, therapistName, timeSlot, bookingDate, gymName, gymId, hotelId, hotelName, venueType, customerEmail, clientName, clientAge, clientPhone, clientAddress, healthConfirmed, dateOfBirth, salutation, gender, pregnancyStatus, notes, communicationPreference, selectedBodyAreas, deepTissueUpgradeActive } = body;

  if (!serviceId) throw new Error("Service ID is required");
  if (!isValidUUID(serviceId)) throw new Error("Invalid service ID format");
  if (!customerEmail || customerEmail === "") throw new Error("Email address is required");
  if (!isValidEmail(customerEmail)) throw new Error("Invalid email format");

  let parsedAge: number | null = null;
  if (clientAge !== undefined && clientAge !== null) {
    parsedAge = typeof clientAge === "number" ? clientAge : parseInt(String(clientAge), 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) throw new Error("Age must be between 18 and 120");
  }

  const validSalutations = ["Herr", "Frau"];
  const sanitizedSalutation = sanitizeString(salutation, 10);
  if (sanitizedSalutation && !validSalutations.includes(sanitizedSalutation)) throw new Error("Invalid salutation");

  const validGenders = ["male", "female"];
  const sanitizedGender = sanitizeString(gender, 10);
  if (sanitizedGender && !validGenders.includes(sanitizedGender)) throw new Error("Invalid gender");

  const validPregnancyStatuses = ["not_pregnant", ""];
  const sanitizedPregnancyStatus = sanitizeString(pregnancyStatus, 20);
  if (sanitizedPregnancyStatus && !validPregnancyStatuses.includes(sanitizedPregnancyStatus)) throw new Error("Invalid pregnancy status");

  const validCommPrefs = ["silent", "light_talk", "normal", ""];
  const sanitizedCommPref = sanitizeString(communicationPreference, 20);

  const sanitizedBookingDate = sanitizeString(bookingDate, 10);
  if (sanitizedBookingDate && !/^\d{4}-\d{2}-\d{2}$/.test(sanitizedBookingDate)) throw new Error("Invalid booking date format");

  const sanitizedGymId = sanitizeString(gymId, 50);
  if (sanitizedGymId && !isValidUUID(sanitizedGymId)) throw new Error("Invalid gym ID format");

  const sanitizedHotelId = sanitizeString(hotelId, 50);
  if (sanitizedHotelId && !isValidUUID(sanitizedHotelId)) throw new Error("Invalid hotel ID format");

  const venueTypeStr = sanitizeString(venueType, 10);
  const resolvedVenueType: "gym" | "hotel" = venueTypeStr === "hotel" || (sanitizedHotelId && !sanitizedGymId) ? "hotel" : "gym";
  if (resolvedVenueType === "hotel" && !sanitizedHotelId) throw new Error("Hotel ID is required for hotel bookings");
  if (resolvedVenueType === "gym" && !sanitizedGymId) {
    // gymId is optional in some flows; keep prior behavior
  }

  // Validate body areas
  let validatedBodyAreas: Array<{ code: string; label?: string; painIntensity: number }> = [];
  if (Array.isArray(selectedBodyAreas)) {
    validatedBodyAreas = selectedBodyAreas
      .filter((a: unknown) => typeof a === "object" && a !== null)
      .slice(0, 20) // max 20 zones
      .map((a: Record<string, unknown>) => ({
        code: sanitizeString(a.code, 30),
        label: sanitizeString(a.label, 50),
        painIntensity: Math.min(10, Math.max(1, Number(a.painIntensity) || 5)),
      }));
  }

  return {
    serviceId: serviceId as string,
    therapistName: sanitizeString(therapistName, 100),
    timeSlot: sanitizeString(timeSlot, 50),
    bookingDate: sanitizedBookingDate,
    gymName: sanitizeString(gymName, 200),
    gymId: sanitizedGymId,
    hotelId: sanitizedHotelId,
    hotelName: sanitizeString(hotelName, 200),
    venueType: resolvedVenueType,
    customerEmail: (customerEmail as string).trim(),
    clientName: sanitizeString(clientName, 100),
    clientAge: parsedAge,
    clientPhone: sanitizeString(clientPhone, 30),
    clientAddress: sanitizeString(clientAddress, 300),
    healthConfirmed: healthConfirmed === true,
    dateOfBirth: sanitizeString(dateOfBirth, 10),
    salutation: sanitizedSalutation,
    gender: sanitizedGender,
    pregnancyStatus: sanitizedPregnancyStatus,
    notes: sanitizeString(notes, 500),
    communicationPreference: sanitizedCommPref,
    selectedBodyAreas: validatedBodyAreas,
    deepTissueUpgradeActive: deepTissueUpgradeActive === true,
  };
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();
  return `fallback-${(req.headers.get("user-agent") || "").slice(0, 50)}-${req.headers.get("origin") || ""}`;
}

function checkRateLimit(clientIP: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const existing = rateLimitMap.get(clientIP);
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) { if (now > value.resetTime) rateLimitMap.delete(key); }
  }
  if (!existing || now > existing.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  if (existing.count >= RATE_LIMIT_MAX) return { allowed: false, remaining: 0, resetIn: existing.resetTime - now };
  existing.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - existing.count, resetIn: existing.resetTime - now };
}

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: "Too many payment requests. Please try again later.", retryAfter: Math.ceil(rateLimit.resetIn / 1000) }), {
        headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rateLimit.resetIn / 1000)) },
        status: 429,
      });
    }

    const body = await req.json();
    const input = validatePaymentInput(body);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Fetch service from DB (base price + duration)
    const { data: serviceData, error: svcErr } = await supabase
      .from("services")
      .select("price, duration_minutes, name")
      .eq("id", input.serviceId)
      .eq("is_active", true)
      .single();

    if (svcErr || !serviceData) throw new Error("Service not found or inactive");

    let basePrice = serviceData.price as number;
    const duration = serviceData.duration_minutes as number;
    const serviceName = serviceData.name as string;

    // Guard: services.price must be a finite, in-range positive number.
    if (!Number.isFinite(basePrice) || basePrice < MIN_PRICE_UNITS || basePrice > MAX_PRICE_UNITS) {
      console.error("Invalid base price from services table", { serviceId: input.serviceId, basePrice });
      throw new Error("Service not found or inactive");
    }

    // Resolve per-venue effective price (custom or active promo) via DB RPC
    const venueIdForPrice = input.venueType === "hotel" ? input.hotelId : input.gymId;
    if (venueIdForPrice) {
      const { data: effective, error: effErr } = await supabase.rpc("get_effective_service_price", {
        _venue_type: input.venueType,
        _venue_id: venueIdForPrice,
        _service_id: input.serviceId,
      });
      if (effErr) {
        console.error("Effective price RPC failed", effErr);
      } else if (effective === null) {
        return new Response(JSON.stringify({ error: "Diese Behandlung ist an diesem Standort nicht verfügbar." }), {
          headers: { ...cors, "Content-Type": "application/json" },
          status: 400,
        });
      } else {
        const effectiveNum = Number(effective);
        // Guard: effective-price RPC output must also be in range.
        if (!Number.isFinite(effectiveNum) || effectiveNum < MIN_PRICE_UNITS || effectiveNum > MAX_PRICE_UNITS) {
          console.error("Invalid effective price from RPC", { venueIdForPrice, serviceId: input.serviceId, effective });
          throw new Error("Service not found or inactive");
        }
        basePrice = effectiveNum;
      }
    }

    // Server-side surcharge calculation (NEVER trust frontend total)
    const surcharge = calculateServerSurcharge(input.selectedBodyAreas, input.deepTissueUpgradeActive);
    if (!Number.isFinite(surcharge) || surcharge < 0 || surcharge > MAX_SURCHARGE_UNITS) {
      console.error("Invalid surcharge calculation", { surcharge, selectedBodyAreas: input.selectedBodyAreas.length });
      throw new Error("Invalid surcharge");
    }

    const finalPrice = basePrice + surcharge;
    // Final guard after surcharge added.
    if (!Number.isFinite(finalPrice) || finalPrice < MIN_PRICE_UNITS || finalPrice > MAX_PRICE_UNITS) {
      console.error("Final price out of range", { basePrice, surcharge, finalPrice });
      throw new Error("Invalid total amount");
    }

    const unitAmountCents = Math.round(finalPrice * 100);
    // Stripe expects integer cents; double-check.
    if (!Number.isInteger(unitAmountCents) || unitAmountCents < MIN_PRICE_UNITS * 100 || unitAmountCents > MAX_PRICE_UNITS * 100) {
      console.error("unit_amount out of range", { unitAmountCents });
      throw new Error("Invalid total amount");
    }

    // Pre-payment slot validation (gym or hotel)
    if (input.venueType === "hotel" && input.hotelId && input.bookingDate && input.timeSlot && input.timeSlot.includes(":")) {
      const { data: isAvailable, error: availError } = await supabase.rpc("check_hotel_slot_availability", {
        p_hotel_id: input.hotelId, p_date: input.bookingDate, p_time: input.timeSlot, p_duration_minutes: duration,
      });
      if (availError || !isAvailable) {
        return new Response(JSON.stringify({ error: "Der gewählte Zeitraum ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Termin." }), { headers: { ...cors, "Content-Type": "application/json" }, status: 409 });
      }

      const { data: existingBooking } = await supabase
        .from("bookings").select("id").eq("hotel_id", input.hotelId).eq("booking_date", input.bookingDate).eq("booking_time", input.timeSlot)
        .not("status", "in", "(cancelled,rescheduled)").maybeSingle();

      if (existingBooking) {
        return new Response(JSON.stringify({ error: "Dieser Termin wurde soeben gebucht. Bitte wählen Sie einen anderen Zeitslot." }), { headers: { ...cors, "Content-Type": "application/json" }, status: 409 });
      }
    } else if (input.venueType === "gym" && input.gymId && input.bookingDate && input.timeSlot && input.timeSlot.includes(":")) {
      const { data: isAvailable, error: availError } = await supabase.rpc("check_slot_availability", {
        p_gym_id: input.gymId, p_date: input.bookingDate, p_time: input.timeSlot, p_duration_minutes: duration,
      });
      if (availError || !isAvailable) {
        return new Response(JSON.stringify({ error: "Der gewählte Zeitraum ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen Termin." }), { headers: { ...cors, "Content-Type": "application/json" }, status: 409 });
      }

      const { data: existingBooking } = await supabase
        .from("bookings").select("id").eq("gym_id", input.gymId).eq("booking_date", input.bookingDate).eq("booking_time", input.timeSlot)
        .not("status", "in", "(cancelled,rescheduled)").maybeSingle();

      if (existingBooking) {
        await supabase.from("booking_events").insert({
          event_type: "conflict_blocked", gym_id: input.gymId, booking_date: input.bookingDate, booking_time: input.timeSlot,
          customer_name: input.clientName || null, customer_email: input.customerEmail,
          details: { reason: "duplicate_slot_pre_payment", blocked_at: "create-payment" }, severity: "warning",
        });
        return new Response(JSON.stringify({ error: "Dieser Termin wurde soeben gebucht. Bitte wählen Sie einen anderen Zeitslot." }), { headers: { ...cors, "Content-Type": "application/json" }, status: 409 });
      }
    }

    // Determine the correct Stripe key based on the venue's country
    let stripeKeyName = "STRIPE_SECRET_KEY"; // Default to Germany
    let currency = "eur";

    if (input.venueType === "hotel" && input.hotelId) {
      const { data: hotelCountry } = await supabase
        .from("hotels")
        .select("country_id, countries(stripe_secret_key_name, currency_code)")
        .eq("id", input.hotelId)
        .single();

      if (hotelCountry?.countries) {
        const countryData = hotelCountry.countries as any;
        stripeKeyName = countryData.stripe_secret_key_name || "STRIPE_SECRET_KEY";
        currency = (countryData.currency_code || "EUR").toLowerCase();
      }
    } else if (input.gymId) {
      const { data: gymCountry } = await supabase
        .from("gyms")
        .select("country_id, countries(stripe_secret_key_name, currency_code)")
        .eq("id", input.gymId)
        .single();

      if (gymCountry?.countries) {
        const countryData = gymCountry.countries as any;
        stripeKeyName = countryData.stripe_secret_key_name || "STRIPE_SECRET_KEY";
        currency = (countryData.currency_code || "EUR").toLowerCase();
      }
    }

    const stripeKey = Deno.env.get(stripeKeyName);
    if (!stripeKey) {
      console.error(`Stripe key not found for: ${stripeKeyName}`);
      throw new Error("Payment processing is not configured for this region.");
    }

    // Initialize Stripe with the country-specific key
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Build description for Stripe receipt
    let description = serviceName;
    if (surcharge > 0) {
      const currencyUpper = currency.toUpperCase();
      description += input.deepTissueUpgradeActive
        ? ` + Deep Tissue Upgrade (+${DEEP_TISSUE_UPGRADE_PRICE} ${currencyUpper})`
        : ` + Intensity Surcharge (+${surcharge.toFixed(2)} ${currencyUpper})`;
    }

    // Build metadata
    const metadata: Record<string, string> = {
      serviceId: input.serviceId,
      bookingDate: input.bookingDate || new Date().toISOString().split("T")[0],
      gymName: input.gymName || (input.venueType === "hotel" ? "" : "MASSAVO Gym"),
      gymId: input.gymId || "",
      hotelName: input.hotelName || "",
      hotelId: input.hotelId || "",
      venueType: input.venueType,
      therapistName: input.therapistName || "Any Available",
      timeSlot: input.timeSlot || "Not specified",
      clientIP: clientIP.slice(0, 50),
      createdAt: new Date().toISOString(),
      clientName: input.clientName || "",
      clientAge: input.clientAge ? String(input.clientAge) : "",
      clientPhone: input.clientPhone || "",
      clientAddress: input.clientAddress || "",
      healthConfirmed: String(input.healthConfirmed),
      dateOfBirth: input.dateOfBirth || "",
      salutation: input.salutation || "",
      gender: input.gender || "",
      pregnancyStatus: input.pregnancyStatus || "",
      notes: input.notes || "",
      communicationPreference: input.communicationPreference || "",
      policyAccepted: "true",
      policyAcceptedAt: new Date().toISOString(),
      basePrice: String(basePrice),
      intensitySurcharge: String(surcharge),
      deepTissueUpgradeActive: String(input.deepTissueUpgradeActive),
      finalPrice: String(finalPrice),
      selectedBodyAreas: JSON.stringify(input.selectedBodyAreas).slice(0, 490),
    };

    // Dynamic checkout session using price_data
    const sessionOptions: Stripe.Checkout.SessionCreateParams = {
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: `Massavo – ${serviceName}`,
            description,
          },
          unit_amount: unitAmountCents,
          // Kleinunternehmer §19 UStG: Preis ist Endpreis ohne USt.
          // 'inclusive' verhindert, dass Stripe oben drauf Steuer rechnet.
          tax_behavior: "inclusive",
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${getRedirectOrigin(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getRedirectOrigin(req)}/payment-canceled`,
      metadata,
      payment_intent_data: { metadata },
    };

    // Customer handling
    if (input.customerEmail) {
      const customers = await stripe.customers.list({ email: input.customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        sessionOptions.customer = customers.data[0].id;
      } else {
        sessionOptions.customer_email = input.customerEmail;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionOptions);
    console.log(`Payment session created: ${session.id} | base=${basePrice} surcharge=${surcharge} total=${finalPrice} IP=${clientIP}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...cors, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) },
      status: 200,
    });
  } catch (error) {
    console.error("Payment error:", error);
    return new Response(JSON.stringify({ error: getSafeErrorMessage(error) }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 500,
    });
  }
});
