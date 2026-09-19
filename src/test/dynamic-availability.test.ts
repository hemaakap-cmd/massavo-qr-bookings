import { describe, it, expect } from "vitest";
import {
  DEFAULT_BUFFER_AFTER,
  DEFAULT_BUFFER_BEFORE,
  HOME_VISIT_TRANSITION_MINUTES,
  calculateOccupiedMinutes,
} from "@/constants/booking";
import {
  generateAvailableTimeSlots,
  parseTimeToMinutes,
  type ExistingBooking,
} from "@/utils/timeSlotCalculator";

const FUTURE_DATE = "2030-06-10"; // Monday, safely in the future
const schedule = { start_time: "09:00", end_time: "18:00", max_hours: 9 };

const bookable = (slots: ReturnType<typeof generateAvailableTimeSlots>) =>
  slots.filter((s) => !s.isBreak).map((s) => s.time);

describe("occupied time rules", () => {
  it("uses 5 min prep + duration + 5 min after for gym/hotel", () => {
    expect(DEFAULT_BUFFER_BEFORE).toBe(5);
    expect(DEFAULT_BUFFER_AFTER).toBe(5);
    expect(calculateOccupiedMinutes(50, "gym")).toBe(60);
    expect(calculateOccupiedMinutes(90, "hotel")).toBe(100);
  });

  it("adds the fixed 30 min travel time for home visits", () => {
    expect(HOME_VISIT_TRANSITION_MINUTES).toBe(30);
    expect(calculateOccupiedMinutes(50, "home")).toBe(90);
    expect(calculateOccupiedMinutes(90, "home")).toBe(130);
  });
});

describe("dynamic slot generation", () => {
  it("spaces 50-minute gym slots by 60 minutes", () => {
    const times = bookable(generateAvailableTimeSlots(schedule, 50, [], FUTURE_DATE));
    expect(times[0]).toBe("09:05");
    const step = parseTimeToMinutes(times[1]) - parseTimeToMinutes(times[0]);
    expect(step).toBe(60);
  });

  it("recalculates spacing when the duration changes to 90 minutes", () => {
    const times = bookable(generateAvailableTimeSlots(schedule, 90, [], FUTURE_DATE));
    const step = parseTimeToMinutes(times[1]) - parseTimeToMinutes(times[0]);
    expect(step).toBe(100);
  });

  it("spaces home-visit slots by duration + 40 minutes", () => {
    const times = bookable(
      generateAvailableTimeSlots(
        schedule, 50, [], FUTURE_DATE, null, null, HOME_VISIT_TRANSITION_MINUTES,
      ),
    );
    const step = parseTimeToMinutes(times[1]) - parseTimeToMinutes(times[0]);
    expect(step).toBe(90);
  });

  it("never offers a slot whose session runs past the working hours", () => {
    const times = bookable(generateAvailableTimeSlots(schedule, 90, [], FUTURE_DATE));
    for (const t of times) {
      expect(parseTimeToMinutes(t) + 90).toBeLessThanOrEqual(parseTimeToMinutes("18:00"));
    }
  });

  it("blocks slots overlapping an existing booking and its buffers", () => {
    const existing: ExistingBooking[] = [
      { booking_time: "15:00", service: { duration_minutes: 50 } },
    ];
    const times = bookable(generateAvailableTimeSlots(schedule, 50, existing, FUTURE_DATE));
    // Therapist occupied 14:55 → 15:55; no offered session may overlap that.
    for (const t of times) {
      const start = parseTimeToMinutes(t) - 5;
      const end = parseTimeToMinutes(t) + 50 + 5;
      expect(start < parseTimeToMinutes("15:55") && end > parseTimeToMinutes("14:55")).toBe(false);
    }
  });

  it("blocks a home-visit booking for its full travel window", () => {
    const existing: ExistingBooking[] = [
      { booking_time: "15:00", service: { duration_minutes: 50 }, buffer_after: 35 },
    ];
    const times = bookable(
      generateAvailableTimeSlots(
        schedule, 50, existing, FUTURE_DATE, null, null, HOME_VISIT_TRANSITION_MINUTES,
      ),
    );
    for (const t of times) {
      expect(parseTimeToMinutes(t)).not.toBe(parseTimeToMinutes("16:00"));
    }
  });
});
