/**
 * Payment recovery — shared safety net for "paid but not booked".
 *
 * Guarantees the invariant:
 *   PAYMENT SUCCESS + BOOKING FAILURE  =>  REFUND (or a durable operational alert)
 *
 * Applies to ALL venue types (gym / hotel / home). The pre-existing conflict
 * paths (SLOT_UNAVAILABLE / DUPLICATE_BOOKING) already refund inline; this
 * module covers every OTHER post-payment failure (DB constraint, transient RPC
 * error, unexpected exception, booking row unreadable, ...) which previously
 * threw with no refund and no alert.
 *
 * Design notes:
 *  - Idempotent: refunds are keyed on the Stripe payment_intent. If a refund
 *    already exists for that intent we do NOT create a second one.
 *  - Never refunds an uncharged payment: callers must only invoke this after
 *    session.payment_status === "paid".
 *  - Always records the outcome in `booking_events` so Admin can see
 *    PAID + BOOKING FAILED + REFUNDED / REFUND_FAILED, even when Stripe is down.
 */

export type RecoveryOutcome =
  | "refunded"
  | "already_refunded"
  | "refund_failed"
  | "skipped_not_paid"
  | "skipped_no_payment_intent";

export interface RecoveryResult {
  outcome: RecoveryOutcome;
  refundId?: string;
  error?: string;
}

/** Minimal shapes so this module stays testable without the real SDKs. */
export interface StripeLike {
  refunds: {
    list: (args: { payment_intent: string; limit?: number }) => Promise<{ data: Array<{ id: string; status?: string | null }> }>;
    create: (args: { payment_intent: string; reason?: string }) => Promise<{ id: string }>;
  };
}

export interface SupabaseLike {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error?: unknown }>;
  };
}

export interface RecoveryContext {
  sessionId: string;
  paymentIntentId: string | null | undefined;
  paymentStatus: string | null | undefined;
  venueType: "gym" | "hotel" | "home";
  gymId?: string | null;
  hotelId?: string | null;
  bookingDate?: string | null;
  bookingTime?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  /** Why the booking failed (sanitised before storage). */
  reason: string;
}

/**
 * Refund a confirmed payment whose booking could not be created, idempotently,
 * and always leave an operational record behind.
 */
export async function recoverFailedBooking(
  stripe: StripeLike | null,
  supabaseAdmin: SupabaseLike,
  ctx: RecoveryContext,
): Promise<RecoveryResult> {
  // NEVER refund something that was not actually charged.
  if (ctx.paymentStatus !== "paid") {
    await recordEvent(supabaseAdmin, ctx, "skipped_not_paid", undefined, undefined);
    return { outcome: "skipped_not_paid" };
  }

  if (!ctx.paymentIntentId || typeof ctx.paymentIntentId !== "string" || !stripe) {
    // Paid but we cannot refund automatically → must be visible to operations.
    await recordEvent(supabaseAdmin, ctx, "skipped_no_payment_intent", undefined, undefined);
    return { outcome: "skipped_no_payment_intent" };
  }

  // Idempotency: if a refund already exists for this payment_intent, stop.
  try {
    const existing = await stripe.refunds.list({ payment_intent: ctx.paymentIntentId, limit: 10 });
    const prior = (existing?.data || []).find((r) => r.status !== "failed" && r.status !== "canceled");
    if (prior) {
      await recordEvent(supabaseAdmin, ctx, "already_refunded", prior.id, undefined);
      return { outcome: "already_refunded", refundId: prior.id };
    }
  } catch (listErr) {
    // If the lookup fails we fall through and attempt the refund; Stripe itself
    // will not double-refund beyond the captured amount.
    console.error("[RECOVERY] refunds.list failed:", listErr);
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: ctx.paymentIntentId,
      reason: "requested_by_customer",
    });
    await recordEvent(supabaseAdmin, ctx, "refunded", refund.id, undefined);
    return { outcome: "refunded", refundId: refund.id };
  } catch (refundErr) {
    const msg = refundErr instanceof Error ? refundErr.message : String(refundErr);
    // Refund failed → this is the highest-severity operational state.
    await recordEvent(supabaseAdmin, ctx, "refund_failed", undefined, msg);
    return { outcome: "refund_failed", error: msg };
  }
}

async function recordEvent(
  supabaseAdmin: SupabaseLike,
  ctx: RecoveryContext,
  outcome: RecoveryOutcome,
  refundId: string | undefined,
  errorMessage: string | undefined,
): Promise<void> {
  // refund_failed / skipped_* mean money is held with no booking → critical.
  const severity = outcome === "refunded" || outcome === "already_refunded" ? "warning" : "critical";
  try {
    await supabaseAdmin.from("booking_events").insert({
      event_type: "booking_failed_after_payment",
      gym_id: ctx.venueType === "gym" ? ctx.gymId ?? null : null,
      hotel_id: ctx.venueType === "hotel" ? ctx.hotelId ?? null : null,
      booking_date: ctx.bookingDate ?? null,
      booking_time: ctx.bookingTime ?? null,
      customer_email: ctx.customerEmail ?? null,
      customer_name: ctx.customerName ?? null,
      details: {
        reason: ctx.reason,
        venue_type: ctx.venueType,
        stripe_session_id: ctx.sessionId,
        payment_intent_id: ctx.paymentIntentId ?? null,
        recovery_outcome: outcome,
        refund_id: refundId ?? null,
        refund_error: errorMessage ?? null,
      },
      severity,
    });
  } catch (logErr) {
    // Logging must never mask the original failure.
    console.error("[RECOVERY] Failed to record booking_events row:", logErr);
  }
}
