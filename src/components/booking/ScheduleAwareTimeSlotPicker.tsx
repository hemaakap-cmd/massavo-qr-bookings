import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Loader2, Calendar, Clock, AlertCircle, Sparkles, Coffee } from "lucide-react";
import type { AvailableDate } from "@/types/schedule";
import {
  generateAvailableTimeSlots,
  type ExistingBooking,
} from "@/utils/timeSlotCalculator";
import { MonthCalendarPicker } from "./MonthCalendarPicker";

interface ScheduleAwareTimeSlotPickerProps {
  gymId?: string;
  hotelId?: string;
  venueType?: "gym" | "hotel";
  serviceDurationMinutes: number;
  selectedDate: string | null;
  selectedTime: string | null;
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
  serviceBufferBefore?: number | null;
  serviceBufferAfter?: number | null;
}

export function ScheduleAwareTimeSlotPicker({
  gymId,
  hotelId,
  venueType = "gym",
  serviceDurationMinutes,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  serviceBufferBefore,
  serviceBufferAfter,
}: ScheduleAwareTimeSlotPickerProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("en") ? enUS : de;
  const isHotel = venueType === "hotel";
  const venueId = isHotel ? hotelId : gymId;

  // Fetch available dates from venue schedule
  const { data: availableDates = [], isLoading: datesLoading } = useQuery({
    queryKey: ["venue-available-dates", venueType, venueId],
    queryFn: async () => {
      const { data, error } = isHotel
        ? await supabase.rpc("get_hotel_available_dates", {
            p_hotel_id: venueId as string,
            p_start_date: new Date().toISOString().split("T")[0],
            p_months_ahead: 3,
          })
        : await supabase.rpc("get_gym_available_dates", {
            p_gym_id: venueId as string,
            p_start_date: new Date().toISOString().split("T")[0],
            p_months_ahead: 3,
          });
      if (error) throw error;
      return data as AvailableDate[];
    },
    enabled: !!venueId,
  });

  // Fetch existing bookings with per-service buffer data
  const { data: existingBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["venue-booked-slots", venueType, venueId, selectedDate],
    queryFn: async () => {
      if (!selectedDate) return [];
      const { data, error } = isHotel
        ? await supabase.rpc("get_hotel_booked_slots", {
            p_hotel_id: venueId as string,
            p_date: selectedDate,
          })
        : await supabase.rpc("get_booked_slots", {
            p_gym_id: venueId as string,
            p_date: selectedDate,
          });
      if (error) throw error;
      return (data || []).map((slot: { booking_time: string; duration_minutes: number; buffer_before: number; buffer_after: number }) => ({
        booking_time: slot.booking_time,
        service: { duration_minutes: slot.duration_minutes },
        buffer_before: slot.buffer_before,
        buffer_after: slot.buffer_after,
      })) as ExistingBooking[];
    },
    enabled: !!venueId && !!selectedDate,
  });

  const selectedSchedule = useMemo(() => {
    if (!selectedDate) return null;
    return availableDates.find((d) => d.available_date === selectedDate);
  }, [availableDates, selectedDate]);

  // Generate available time slots with intelligent scheduling
  const timeSlots = useMemo(() => {
    if (!selectedSchedule || !selectedDate) return [];

    return generateAvailableTimeSlots(
      {
        start_time: selectedSchedule.start_time,
        end_time: selectedSchedule.end_time,
        max_hours: selectedSchedule.max_hours || 8,
      },
      serviceDurationMinutes,
      existingBookings,
      selectedDate,
      serviceBufferBefore,
      serviceBufferAfter
    );
  }, [selectedSchedule, existingBookings, serviceDurationMinutes, selectedDate, serviceBufferBefore, serviceBufferAfter]);

  if (datesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (availableDates.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="font-display text-lg font-semibold text-foreground mb-2">
          {t("scheduleSlots.noDates")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("scheduleSlots.noDatesDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h3 className="font-display text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
        <Calendar className="h-6 w-6 text-primary" />
        {t("scheduleSlots.pickDateTime")}
      </h3>

      <MonthCalendarPicker
        availableDates={availableDates}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          onSelectDate(date);
          onSelectTime("");
        }}
      />

      {selectedDate && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <p className="font-body text-sm text-muted-foreground font-medium">
              {t("scheduleSlots.availableTimesOn", { date: format(parseISO(selectedDate), "d. MMMM", { locale: dateLocale }) })}
            </p>
          </div>

          {bookingsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="text-center py-8 bg-secondary/50 rounded-lg">
              <p className="text-muted-foreground">
                {t("scheduleSlots.noSlots")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {timeSlots.map((slot) => (
                slot.isBreak ? (
                  <div
                    key={slot.id}
                    className="col-span-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent/30 border border-accent/50 text-accent-foreground/70"
                  >
                    <Coffee className="h-4 w-4" />
                    <span className="font-body text-xs font-medium">
                      Pause {slot.time}
                    </span>
                  </div>
                ) : (
                  <button
                    key={slot.id}
                    onClick={() => slot.available && onSelectTime(slot.time)}
                    disabled={!slot.available}
                    className={`relative py-3 px-4 rounded-xl font-display text-base font-semibold transition-all duration-200 ${
                      selectedTime === slot.time
                        ? "bg-primary text-primary-foreground shadow-lg scale-105"
                        : slot.available
                        ? "bg-secondary/80 text-foreground hover:bg-primary/20 hover:text-primary border border-border hover:border-primary/30"
                        : "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
                    }`}
                  >
                    {slot.time}
                    {slot.recommended && selectedTime !== slot.time && (
                      <Sparkles className="absolute top-1 right-1 h-3.5 w-3.5 text-primary" />
                    )}
                  </button>
                )
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {timeSlots.some(s => s.recommended) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>Empfohlene Zeiten</span>
              </div>
            )}
            {timeSlots.some(s => s.isBreak) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Coffee className="h-3 w-3 text-accent-foreground/70" />
                <span>Therapeuten-Pause</span>
              </div>
            )}
          </div>

          {selectedSchedule && (
            <p className="text-xs text-muted-foreground text-center">
              {t("scheduleSlots.workingHours", { start: selectedSchedule.start_time.slice(0, 5), end: selectedSchedule.end_time.slice(0, 5) })}
              {" • "}{t("scheduleSlots.maxPerDay", { hours: selectedSchedule.max_hours })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
