import type { QueryClient } from "@tanstack/react-query";

/**
 * Centralized cache invalidation for cross-module synchronization.
 * 
 * Every mutation that touches bookings, therapist assignments, schedules,
 * or attendance MUST call the appropriate function here instead of
 * manually listing query keys.  This guarantees that ALL dependent views
 * (admin dashboard, staff dashboard, customer booking, monitoring, etc.)
 * stay in sync after any change.
 */

// ─── Query key registry ──────────────────────────────────────────────
const BOOKING_KEYS = [
  "admin-staff-bookings",
  "staff-bookings",
  "daily-bookings",
  "absence-affected-bookings",
  "gym-booked-slots",
] as const;

const ASSIGNMENT_KEYS = [
  "therapist-assignments",
  "staff-assignment",
  "staff-assigned-locations",
  "available-replacements",
  "therapist-leaves",
  "therapist-on-leave",
  "leave-affected-bookings",
] as const;

const SCHEDULE_KEYS = [
  "therapist-weekly-schedules",
  "gym-available-dates",
  "schedule-exceptions",
] as const;

const MONITORING_KEYS = [
  "booking-events",
] as const;

// ─── Public invalidation helpers ─────────────────────────────────────

/**
 * Invalidate all booking-related caches.
 * Call after: create / cancel / reassign / postpone / status change.
 */
export function invalidateBookingCaches(qc: QueryClient) {
  for (const key of BOOKING_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Invalidate all therapist-assignment caches.
 * Call after: assignment create / update / delete / absence actions.
 */
export function invalidateAssignmentCaches(qc: QueryClient) {
  for (const key of ASSIGNMENT_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Invalidate all schedule caches.
 * Call after: weekly schedule / gym schedule / exception changes.
 */
export function invalidateScheduleCaches(qc: QueryClient) {
  for (const key of SCHEDULE_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Full system sync — invalidates EVERYTHING.
 * Use after high-impact operations (absence handling, bulk reassign, schedule exceptions).
 */
export function invalidateAllBookingSystem(qc: QueryClient) {
  invalidateBookingCaches(qc);
  invalidateAssignmentCaches(qc);
  invalidateScheduleCaches(qc);
  for (const key of MONITORING_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * Booking + Assignment sync (most common combo).
 * Use after: reassign, postpone, cancel with reassignment.
 */
export function invalidateBookingAndAssignments(qc: QueryClient) {
  invalidateBookingCaches(qc);
  invalidateAssignmentCaches(qc);
}
