import {
  DEFAULT_BUFFER_BEFORE,
  DEFAULT_BUFFER_AFTER,
  getReservedStartTime,
  getReservedEndTime,
  getServiceBuffers,
  calculateRestBreak,
  type RestBreak,
} from "@/constants/booking";

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  recommended?: boolean;
  isBreak?: boolean; // marks a rest break slot
}

export interface ReservedWindow {
  reservedStart: number;
  reservedEnd: number;
  visibleStart: number;
  visibleEnd: number;
}

export interface ExistingBooking {
  booking_time: string;
  service?: {
    duration_minutes: number;
  } | null;
  buffer_before?: number | null;
  buffer_after?: number | null;
}

export interface ScheduleInfo {
  start_time: string;
  end_time: string;
  max_hours: number;
}

/**
 * Parse time string (HH:MM or HH:MM:SS) to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hour, min] = timeStr.split(":").map(Number);
  return hour * 60 + min;
}

/**
 * Convert minutes from midnight to time string (HH:MM)
 */
export function minutesToTimeString(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${hour.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

/**
 * Convert existing bookings to reserved time windows using per-booking buffers
 */
export function calculateReservedWindows(bookings: ExistingBooking[]): ReservedWindow[] {
  return bookings
    .map((booking) => {
      const bookingStart = parseTimeToMinutes(booking.booking_time);
      const bookingDuration = booking.service?.duration_minutes || 0;
      const buffers = getServiceBuffers(booking.buffer_before, booking.buffer_after);

      return {
        reservedStart: getReservedStartTime(bookingStart, buffers.before),
        reservedEnd: getReservedEndTime(bookingStart, bookingDuration, buffers.after),
        visibleStart: bookingStart,
        visibleEnd: bookingStart + bookingDuration,
      };
    })
    .sort((a, b) => a.reservedStart - b.reservedStart);
}

/**
 * Calculate total booked minutes (service time only, excluding buffers)
 * Buffers are transition gaps, not billable work time
 */
export function calculateBookedMinutes(bookings: ExistingBooking[]): number {
  return bookings.reduce((total, booking) => {
    const bookingDuration = booking.service?.duration_minutes || 0;
    return total + bookingDuration;
  }, 0);
}

/**
 * Check if two time windows overlap
 */
export function windowsOverlap(
  start1: number, end1: number,
  start2: number, end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Smart spreading: score a slot based on distance from existing bookings
 */
function calculateSpreadScore(
  slotStart: number,
  reservedWindows: ReservedWindow[],
  scheduleStart: number,
  scheduleEnd: number
): number {
  if (reservedWindows.length === 0) {
    const midpoint = (scheduleStart + scheduleEnd) / 2;
    return 100 - Math.abs(slotStart - midpoint);
  }

  let minDistance = Infinity;
  for (const w of reservedWindows) {
    const dist = Math.min(
      Math.abs(slotStart - w.visibleStart),
      Math.abs(slotStart - w.visibleEnd)
    );
    minDistance = Math.min(minDistance, dist);
  }

  return minDistance;
}

/**
 * Check if a slot overlaps with the rest break window
 */
function overlapsBreak(
  slotStart: number,
  slotEnd: number,
  restBreak: RestBreak | null
): boolean {
  if (!restBreak) return false;
  return slotStart < restBreak.endMinutes && slotEnd > restBreak.startMinutes;
}

/**
 * Generate available time slots with intelligent scheduling
 * 
 * Features:
 * - Per-service buffer overrides
 * - Smart rest breaks based on shift length
 * - Smart spreading: recommends evenly distributed slots
 * - Prevents overlaps with per-booking buffer awareness
 * - Max hours enforcement
 */
export function generateAvailableTimeSlots(
  schedule: ScheduleInfo,
  serviceDurationMinutes: number,
  existingBookings: ExistingBooking[],
  selectedDate: string,
  serviceBufferBefore?: number | null,
  serviceBufferAfter?: number | null
): TimeSlot[] {
  const slots: TimeSlot[] = [];

  const buffers = getServiceBuffers(serviceBufferBefore, serviceBufferAfter);
  const scheduleStart = parseTimeToMinutes(schedule.start_time);
  const scheduleEnd = parseTimeToMinutes(schedule.end_time);

  // Calculate rest break
  const restBreak = calculateRestBreak(scheduleStart, scheduleEnd, schedule.max_hours || 8);

  const reservedWindows = calculateReservedWindows(existingBookings);

  // Max hours is a soft target — the schedule window (start_time to end_time)
  // is the real boundary. When demand is high, allow bookings to fill the full window.

  const earliestBookableTime = scheduleStart + buffers.before;
  let currentTime = earliestBookableTime;
  let slotId = 1;
  let breakSlotAdded = false;

  const validSlots: { time: number; timeStr: string; spreadScore: number; isBreak: boolean }[] = [];

  // The service must fit within schedule. Buffer after is only needed between sessions,
  // NOT after the last session of the day (no next client to transition to).
  while (currentTime + serviceDurationMinutes <= scheduleEnd) {
    const timeStr = minutesToTimeString(currentTime);

    // Check if we've reached the break window — insert break marker
    if (restBreak && !breakSlotAdded && currentTime >= restBreak.startMinutes) {
      validSlots.push({
        time: restBreak.startMinutes,
        timeStr: `${minutesToTimeString(restBreak.startMinutes)} - ${minutesToTimeString(restBreak.endMinutes)}`,
        spreadScore: 0,
        isBreak: true,
      });
      breakSlotAdded = true;
      currentTime = restBreak.endMinutes + buffers.before;
      continue;
    }

    const slotReservedStart = getReservedStartTime(currentTime, buffers.before);
    // For collision detection with OTHER bookings, use full reserved window (with buffer)
    const slotReservedEnd = getReservedEndTime(currentTime, serviceDurationMinutes, buffers.after);
    // But for schedule boundary, only the service needs to fit
    const slotServiceEnd = currentTime + serviceDurationMinutes;

    // Skip if slot overlaps with rest break
    if (overlapsBreak(slotReservedStart, slotReservedEnd, restBreak)) {
      if (restBreak && !breakSlotAdded) {
        validSlots.push({
          time: restBreak.startMinutes,
          timeStr: `${minutesToTimeString(restBreak.startMinutes)} - ${minutesToTimeString(restBreak.endMinutes)}`,
          spreadScore: 0,
          isBreak: true,
        });
        breakSlotAdded = true;
      }
      currentTime = restBreak!.endMinutes + buffers.before;
      continue;
    }

    const conflictingWindow = reservedWindows.find((w) =>
      windowsOverlap(slotReservedStart, slotReservedEnd, w.reservedStart, w.reservedEnd)
    );

    const wouldExceedMax = false; // Schedule window is the real limit, not max_hours

    let isPast = false;
    if (selectedDate === new Date().toISOString().split("T")[0]) {
      const now = new Date();
      const hour = Math.floor(currentTime / 60);
      const min = currentTime % 60;
      const slotDate = new Date();
      slotDate.setHours(hour, min, 0, 0);
      isPast = slotDate <= now;
    }

    const isAvailable = !conflictingWindow && !wouldExceedMax && !isPast;

    if (conflictingWindow) {
      currentTime = conflictingWindow.reservedEnd + buffers.before;
    } else if (isAvailable) {
      const spreadScore = calculateSpreadScore(
        currentTime, reservedWindows, scheduleStart, scheduleEnd
      );
      validSlots.push({ time: currentTime, timeStr, spreadScore, isBreak: false });
      // Advance: if the buffer would fit within schedule, use it for spacing.
      // If not (last slot of the day), just move past the service end.
      if (slotReservedEnd <= scheduleEnd) {
        currentTime = slotReservedEnd + buffers.before;
      } else {
        // Buffer extends beyond schedule — this was the last possible slot
        break;
      }
    } else {
      currentTime += 5;
    }
  }

  // Mark top 3 spread-score slots as recommended (excluding breaks)
  const nonBreakSlots = validSlots.filter(s => !s.isBreak);
  const sortedBySpread = [...nonBreakSlots].sort((a, b) => b.spreadScore - a.spreadScore);
  const recommendedTimes = new Set(sortedBySpread.slice(0, 3).map(s => s.time));

  for (const slot of validSlots) {
    slots.push({
      id: `${slotId++}`,
      time: slot.timeStr,
      available: !slot.isBreak,
      recommended: !slot.isBreak && recommendedTimes.has(slot.time),
      isBreak: slot.isBreak,
    });
  }

  return slots;
}
