// Default buffer times for massage sessions (in minutes)
// Only a 5-minute gap between sessions (post-session transition)
export const DEFAULT_BUFFER_BEFORE = 0;
export const DEFAULT_BUFFER_AFTER = 5;

// Legacy aliases for backward compatibility
export const BUFFER_BEFORE_SESSION = DEFAULT_BUFFER_BEFORE;
export const BUFFER_AFTER_SESSION = DEFAULT_BUFFER_AFTER;
export const TOTAL_BUFFER_TIME = BUFFER_BEFORE_SESSION + BUFFER_AFTER_SESSION;

/**
 * Get effective buffer times for a service, using per-service overrides when available
 */
export function getServiceBuffers(
  bufferBefore?: number | null,
  bufferAfter?: number | null
): { before: number; after: number } {
  return {
    before: bufferBefore ?? DEFAULT_BUFFER_BEFORE,
    after: bufferAfter ?? DEFAULT_BUFFER_AFTER,
  };
}

/**
 * Calculate the total reserved time for a booking
 */
export function calculateReservedTime(
  serviceDurationMinutes: number,
  bufferBefore?: number | null,
  bufferAfter?: number | null
): number {
  const buffers = getServiceBuffers(bufferBefore, bufferAfter);
  return serviceDurationMinutes + buffers.before + buffers.after;
}

/**
 * Calculate when a slot's reserved window starts (accounting for pre-session buffer)
 */
export function getReservedStartTime(
  slotStartMinutes: number,
  bufferBefore?: number | null
): number {
  const before = bufferBefore ?? DEFAULT_BUFFER_BEFORE;
  return slotStartMinutes - before;
}

/**
 * Calculate when a slot's reserved window ends (accounting for post-session buffer)
 */
export function getReservedEndTime(
  slotStartMinutes: number,
  serviceDurationMinutes: number,
  bufferAfter?: number | null
): number {
  const after = bufferAfter ?? DEFAULT_BUFFER_AFTER;
  return slotStartMinutes + serviceDurationMinutes + after;
}

// ═══════════════════════════════════════════════════════
// SMART REST BREAK SYSTEM
// Automatically schedules therapist breaks based on shift length
// ═══════════════════════════════════════════════════════

export interface RestBreak {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

/**
 * Calculate break duration based on total working hours
 * < 6h  → no break (maximize every minute)
 * ≥ 6h and < 8h → 15 min break
 * ≥ 8h  → 30 min break
 */
export function getBreakDuration(maxHours: number): number {
  if (maxHours >= 8) return 30;
  if (maxHours >= 6) return 15;
  return 0;
}

/**
 * Calculate the optimal rest break window placed at the midpoint of the shift.
 * Break is based on ACTUAL working window duration, not max_hours config.
 * Returns null if no break is needed.
 */
export function calculateRestBreak(
  scheduleStartMinutes: number,
  scheduleEndMinutes: number,
  _maxHours: number
): RestBreak | null {
  // Use actual shift duration, not max_hours_per_day
  const actualHours = (scheduleEndMinutes - scheduleStartMinutes) / 60;
  const breakDuration = getBreakDuration(actualHours);
  if (breakDuration === 0) return null;

  // Place break at the midpoint of the working window
  const midpoint = Math.floor((scheduleStartMinutes + scheduleEndMinutes) / 2);
  const breakStart = midpoint - Math.floor(breakDuration / 2);
  const breakEnd = breakStart + breakDuration;

  return {
    startMinutes: breakStart,
    endMinutes: breakEnd,
    durationMinutes: breakDuration,
  };
}
