/**
 * Authoritative server-side booking window validation.
 *
 * SECURITY (remediation items 3 + 4): date/time were previously accepted from
 * the client and only sanity-checked in the UI, so a crafted request could
 * create a paid booking in the past or years in the future. Every write path
 * that fixes a booking slot (create-payment, respond-to-reschedule,
 * manage-booking) must run through `validateBookingWindow` BEFORE it touches
 * Stripe or the database.
 */

/** Bookings must start at least this many minutes from now. */
export const MIN_LEAD_MINUTES = 30;
/** Bookings may not be further out than this. */
export const MAX_DAYS_AHEAD = 180;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export interface BookingWindowResult {
  valid: boolean;
  /** Safe, user-presentable reason (no internals). */
  error?: string;
  /** Normalised `HH:MM:SS` time when valid. */
  normalizedTime?: string;
  /** Parsed slot start in UTC. */
  startsAt?: Date;
}

/**
 * Validate a booking date/time pair.
 *
 * Times are interpreted in the venue's local wall-clock. Massavo operates in
 * Europe/Berlin and the Gulf (UTC+2..+4), so we evaluate the lead-time bound
 * against the most permissive offset (UTC+4) and the far-future bound against
 * plain UTC. This rejects clearly-invalid past/far-future slots without ever
 * rejecting a legitimate same-day booking because of a timezone edge.
 */
export function validateBookingWindow(
  date: unknown,
  time: unknown,
  now: Date = new Date(),
): BookingWindowResult {
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return { valid: false, error: "Invalid booking date." };
  }
  if (typeof time !== "string" || !TIME_RE.test(time)) {
    return { valid: false, error: "Invalid booking time." };
  }

  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);

  // Reject impossible calendar dates (e.g. 2026-02-31 rolling over).
  const startsAt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  if (
    startsAt.getUTCFullYear() !== y ||
    startsAt.getUTCMonth() !== m - 1 ||
    startsAt.getUTCDate() !== d
  ) {
    return { valid: false, error: "Invalid booking date." };
  }

  // Most permissive venue offset (UTC+4) → earliest real-world instant.
  const earliestRealInstantMs = startsAt.getTime() - 4 * 60 * 60 * 1000;
  const minAllowedMs = now.getTime() + MIN_LEAD_MINUTES * 60 * 1000;
  if (earliestRealInstantMs < minAllowedMs) {
    return { valid: false, error: "This appointment slot is in the past or too soon." };
  }

  const maxAllowedMs = now.getTime() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  if (startsAt.getTime() > maxAllowedMs) {
    return {
      valid: false,
      error: `Appointments can only be booked up to ${MAX_DAYS_AHEAD} days in advance.`,
    };
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    valid: true,
    normalizedTime: `${pad(hh)}:${pad(mm)}:00`,
    startsAt,
  };
}
