/**
 * Payment-safety regression tests — deterministic, no live calls, no charges.
 *
 * These exercise the REAL recovery module used by verify-payment
 * (supabase/functions/_shared/payment-recovery.ts) with mocked Stripe/Supabase,
 * so the invariant is proven by execution rather than by code inspection:
 *
 *   PAYMENT SUCCESS + BOOKING FAILURE => REFUND or durable operational alert
 *
 * Covers gym / hotel / home, refund idempotency, refund failure, and the
 * "never refund an uncharged payment" guard.
 */
import { describe, it, expect, vi } from "vitest";
import {
  recoverFailedBooking,
  type RecoveryContext,
  type StripeLike,
  type SupabaseLike,
} from "../../supabase/functions/_shared/payment-recovery.ts";

/** Collects rows written to booking_events so we can assert the alert. */
function makeSupabase() {
  const rows: Record<string, unknown>[] = [];
  const supabase: SupabaseLike = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        rows.push(row);
        return {};
      },
    }),
  };
  return { supabase, rows };
}

function makeStripe(opts: {
  existingRefunds?: Array<{ id: string; status?: string | null }>;
  createFails?: boolean;
  listFails?: boolean;
}): { stripe: StripeLike; created: string[] } {
  const created: string[] = [];
  const stripe: StripeLike = {
    refunds: {
      list: async () => {
        if (opts.listFails) throw new Error("stripe list down");
        return { data: opts.existingRefunds ?? [] };
      },
      create: async ({ payment_intent }) => {
        if (opts.createFails) throw new Error("card_not_refundable");
        created.push(payment_intent);
        return { id: `re_${created.length}` };
      },
    },
  };
  return { stripe, created };
}

const baseCtx = (over: Partial<RecoveryContext> = {}): RecoveryContext => ({
  sessionId: "cs_test_123",
  paymentIntentId: "pi_test_123",
  paymentStatus: "paid",
  venueType: "gym",
  gymId: "gym-1",
  hotelId: null,
  bookingDate: "2099-01-05",
  bookingTime: "12:00",
  customerEmail: "customer@example.com",
  customerName: "Test Customer",
  reason: "booking_rpc_failed: constraint violation",
  ...over,
});

describe("PAYMENT SAFETY — non-conflict booking failure triggers refund", () => {
  it.each(["gym", "hotel", "home"] as const)(
    "%s: paid + booking failure → refund created + alert recorded",
    async (venueType) => {
      const { supabase, rows } = makeSupabase();
      const { stripe, created } = makeStripe({});
      const res = await recoverFailedBooking(stripe, supabase, baseCtx({ venueType }));

      expect(res.outcome).toBe("refunded");
      expect(created).toEqual(["pi_test_123"]); // exactly ONE refund
      expect(rows).toHaveLength(1);
      expect(rows[0].event_type).toBe("booking_failed_after_payment");
      const details = rows[0].details as Record<string, unknown>;
      expect(details.recovery_outcome).toBe("refunded");
      expect(details.venue_type).toBe(venueType);
      expect(details.stripe_session_id).toBe("cs_test_123");
    },
  );
});

describe("PAYMENT SAFETY — refund idempotency", () => {
  it("does NOT create a second refund when one already exists", async () => {
    const { supabase, rows } = makeSupabase();
    const { stripe, created } = makeStripe({
      existingRefunds: [{ id: "re_existing", status: "succeeded" }],
    });
    const res = await recoverFailedBooking(stripe, supabase, baseCtx());

    expect(res.outcome).toBe("already_refunded");
    expect(res.refundId).toBe("re_existing");
    expect(created).toEqual([]); // no duplicate refund
    expect((rows[0].details as Record<string, unknown>).recovery_outcome).toBe("already_refunded");
  });

  it("ignores failed/canceled prior refunds and does refund", async () => {
    const { supabase } = makeSupabase();
    const { stripe, created } = makeStripe({
      existingRefunds: [{ id: "re_dead", status: "failed" }],
    });
    const res = await recoverFailedBooking(stripe, supabase, baseCtx());
    expect(res.outcome).toBe("refunded");
    expect(created).toHaveLength(1);
  });

  it("running recovery twice yields at most one NEW refund (simulated re-verify)", async () => {
    const { supabase } = makeSupabase();
    const issued: Array<{ id: string; status?: string | null }> = [];
    const stripe: StripeLike = {
      refunds: {
        list: async () => ({ data: [...issued] }),
        create: async () => {
          const r = { id: `re_${issued.length + 1}`, status: "succeeded" };
          issued.push(r);
          return { id: r.id };
        },
      },
    };
    const first = await recoverFailedBooking(stripe, supabase, baseCtx());
    const second = await recoverFailedBooking(stripe, supabase, baseCtx());

    expect(first.outcome).toBe("refunded");
    expect(second.outcome).toBe("already_refunded");
    expect(issued).toHaveLength(1); // duplicate verify-payment ⇒ ONE refund
  });
});

describe("PAYMENT SAFETY — refund failure still raises a durable alert", () => {
  it("refund_failed → critical booking_events row (never silent)", async () => {
    const { supabase, rows } = makeSupabase();
    const { stripe } = makeStripe({ createFails: true });
    const res = await recoverFailedBooking(stripe, supabase, baseCtx());

    expect(res.outcome).toBe("refund_failed");
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("critical");
    const details = rows[0].details as Record<string, unknown>;
    expect(details.recovery_outcome).toBe("refund_failed");
    expect(String(details.refund_error)).toContain("card_not_refundable");
  });

  it("missing payment_intent → critical alert, no refund attempted", async () => {
    const { supabase, rows } = makeSupabase();
    const { stripe, created } = makeStripe({});
    const res = await recoverFailedBooking(stripe, supabase, baseCtx({ paymentIntentId: null }));

    expect(res.outcome).toBe("skipped_no_payment_intent");
    expect(created).toEqual([]);
    expect(rows[0].severity).toBe("critical");
  });

  it("stripe unavailable for lookup still attempts the refund (fails safe)", async () => {
    const { supabase } = makeSupabase();
    const { stripe, created } = makeStripe({ listFails: true });
    const res = await recoverFailedBooking(stripe, supabase, baseCtx());
    expect(res.outcome).toBe("refunded");
    expect(created).toHaveLength(1);
  });
});

describe("PAYMENT SAFETY — never refund an uncharged payment", () => {
  it("unpaid session → no refund, recorded as skipped", async () => {
    const { supabase, rows } = makeSupabase();
    const { stripe, created } = makeStripe({});
    const res = await recoverFailedBooking(stripe, supabase, baseCtx({ paymentStatus: "unpaid" }));

    expect(res.outcome).toBe("skipped_not_paid");
    expect(created).toEqual([]); // critical: no refund for money never taken
    expect(rows).toHaveLength(1);
  });
});

describe("PAYMENT SAFETY — logging never masks the failure", () => {
  it("returns an outcome even if booking_events insert throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabase: SupabaseLike = {
      from: () => ({ insert: async () => { throw new Error("db down"); } }),
    };
    const { stripe } = makeStripe({});
    const res = await recoverFailedBooking(stripe, supabase, baseCtx());
    expect(res.outcome).toBe("refunded"); // refund still happened
    spy.mockRestore();
  });
});
