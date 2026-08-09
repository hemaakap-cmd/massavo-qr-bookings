/**
 * stripe-webhook Edge Function
 *
 * Reliable, idempotent Stripe webhook receiver.
 *
 * Why this exists:
 *   verify-payment is invoked by the browser after redirect. If a customer
 *   closes the tab right after paying, no booking is ever created. This
 *   webhook guarantees that for every successful Stripe payment we attempt
 *   booking creation server-side.
 *
 * Design:
 *   1. Verify the Stripe signature using STRIPE_WEBHOOK_SECRET (with optional
 *      per-country secrets STRIPE_WEBHOOK_SECRET_<COUNTRYCODE>).
 *   2. Record every event in `stripe_webhook_events` keyed on stripe_event_id.
 *      The UNIQUE index gives us idempotency for free — duplicate deliveries
 *      are flagged and skipped.
 *   3. On `checkout.session.completed` we call verify-payment internally with
 *      the session id. verify-payment is already idempotent via
 *      stripe_session_id, so this is safe whether or not the browser
 *      redirect already fired.
 *   4. Other relevant events (payment_intent.payment_failed,
 *      checkout.session.expired) are logged into booking_events for the
 *      monitoring center.
 *
 * IMPORTANT: This function MUST run with verify_jwt = false (configured in
 * supabase/config.toml) because Stripe will not send a Supabase JWT.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/**
 * Try to verify the signature against every configured webhook secret.
 * Supports per-country secrets like STRIPE_WEBHOOK_SECRET_DE.
 */
async function verifyAndConstructEvent(
  rawBody: string,
  signature: string,
): Promise<{ event: Stripe.Event; stripe: Stripe } | null> {
  // Collect all candidate (apiKey, webhookSecret) pairs.
  const { data: countries } = await supabaseAdmin
    .from("countries")
    .select("code, stripe_secret_key_name");

  const candidates: Array<{ apiKey: string; webhookSecret: string }> = [];

  // Default
  const defaultApiKey = Deno.env.get("STRIPE_SECRET_KEY");
  const defaultWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (defaultApiKey && defaultWebhookSecret) {
    candidates.push({ apiKey: defaultApiKey, webhookSecret: defaultWebhookSecret });
  }

  // Per-country overrides (optional)
  for (const c of countries ?? []) {
    const code = (c as { code?: string }).code?.toUpperCase();
    const apiKeyName = (c as { stripe_secret_key_name?: string }).stripe_secret_key_name;
    if (!code || !apiKeyName) continue;
    const apiKey = Deno.env.get(apiKeyName);
    const webhookSecret = Deno.env.get(`STRIPE_WEBHOOK_SECRET_${code}`);
    if (apiKey && webhookSecret) {
      candidates.push({ apiKey, webhookSecret });
    }
  }

  if (candidates.length === 0) {
    console.error("[stripe-webhook] No STRIPE_WEBHOOK_SECRET configured");
    return null;
  }

  for (const { apiKey, webhookSecret } of candidates) {
    try {
      const stripe = new Stripe(apiKey, { apiVersion: "2025-08-27.basil" });
      const event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret,
      );
      return { event, stripe };
    } catch (_e) {
      // try next secret
    }
  }
  return null;
}

async function callVerifyPayment(sessionId: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const url = `${SUPABASE_URL}/functions/v1/verify-payment`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Service role lets us hit the function regardless of verify_jwt
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ sessionId }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, {
    extraAllowHeaders: ["stripe-signature"],
    methods: "POST, OPTIONS",
  });
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.warn("[stripe-webhook] Missing stripe-signature header");
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }

  const rawBody = await req.text();

  const verified = await verifyAndConstructEvent(rawBody, signature);
  if (!verified) {
    console.error("[stripe-webhook] Signature verification failed");
    return new Response("Invalid signature", { status: 400, headers: corsHeaders });
  }

  const { event } = verified;

  // Extract session id (where applicable) for cross-referencing.
  let stripeSessionId: string | null = null;
  const obj = event.data?.object as Record<string, unknown> | undefined;
  if (obj && typeof obj === "object") {
    if (event.type.startsWith("checkout.session.") && typeof obj.id === "string") {
      stripeSessionId = obj.id;
    } else if (event.type.startsWith("payment_intent.")) {
      // Try to find the session this payment_intent belongs to (best-effort).
      const piId = typeof obj.id === "string" ? obj.id : null;
      if (piId) {
        const { data: bk } = await supabaseAdmin
          .from("bookings")
          .select("stripe_session_id")
          .eq("payment_status", "paid")
          .ilike("stripe_session_id", "%")
          .limit(1);
        // Not strictly necessary — kept null if not found.
        if (bk && bk[0]?.stripe_session_id) stripeSessionId = bk[0].stripe_session_id as string;
      }
    }
  }

  // 1. Idempotent insert: rely on UNIQUE(stripe_event_id).
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      webhook_status: "processing",
      payload: event as unknown as Record<string, unknown>,
      stripe_session_id: stripeSessionId,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Most likely a duplicate event — flag it and ack.
    if ((insertErr as { code?: string }).code === "23505") {
      console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
      await supabaseAdmin
        .from("stripe_webhook_events")
        .update({ webhook_status: "duplicate" })
        .eq("stripe_event_id", event.id)
        .neq("webhook_status", "processed");
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[stripe-webhook] Failed to record event:", insertErr);
    // Still 200 so Stripe doesn't retry forever on our internal storage error;
    // we have logs.
    return new Response(JSON.stringify({ received: true, stored: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventRowId = inserted?.id;

  // 2. Dispatch by type.
  let processedOk = true;
  let bookingId: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" && session.id) {
        const result = await callVerifyPayment(session.id);
        if (!result.ok) {
          processedOk = false;
          errorMessage = `verify-payment ${result.status}: ${result.body.slice(0, 500)}`;
        } else {
          try {
            const parsed = JSON.parse(result.body) as { bookingId?: string };
            if (parsed.bookingId) bookingId = parsed.bookingId;
          } catch {
            // ignore parse errors
          }
        }
      } else {
        // Session completed but not paid (rare) — just log.
        console.log(`[stripe-webhook] checkout.session.completed but not paid: ${session.id}`);
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const md = (session.metadata ?? {}) as Record<string, string>;
      const venueType = md.venueType === "hotel" ? "hotel" : "gym";
      await supabaseAdmin.from("booking_events").insert({
        event_type: "checkout_expired",
        gym_id: venueType === "gym" ? (md.gymId || null) : null,
        hotel_id: venueType === "hotel" ? (md.hotelId || null) : null,
        venue_type: venueType,
        booking_date: md.bookingDate || null,
        booking_time: md.timeSlot || null,
        customer_email: session.customer_details?.email ?? null,
        details: { stripe_session_id: session.id, reason: "checkout_expired" },
        severity: "info",
      });
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabaseAdmin.from("booking_events").insert({
        event_type: "payment_failed",
        details: {
          payment_intent_id: pi.id,
          last_payment_error: pi.last_payment_error?.message ?? null,
        },
        severity: "error",
      });
    } else {
      // Unhandled event types — recorded as `processed` since we deliberately ignore them.
      console.log(`[stripe-webhook] Ignored event type: ${event.type}`);
    }
  } catch (e) {
    processedOk = false;
    errorMessage = e instanceof Error ? e.message : String(e);
    console.error("[stripe-webhook] Dispatch error:", errorMessage);
  }

  // 3. Persist final status.
  if (eventRowId) {
    await supabaseAdmin
      .from("stripe_webhook_events")
      .update({
        webhook_status: processedOk ? "processed" : "failed",
        processed_at: new Date().toISOString(),
        error_message: errorMessage,
        booking_id: bookingId,
      })
      .eq("id", eventRowId);
  }

  // Always 2xx so Stripe stops retrying once we've recorded the event;
  // failures are visible in stripe_webhook_events for ops to replay.
  return new Response(
    JSON.stringify({ received: true, processed: processedOk, bookingId }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});