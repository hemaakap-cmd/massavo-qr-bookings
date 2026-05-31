import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvailableDate } from "@/types/schedule";

interface MonthCalendarPickerProps {
  availableDates: AvailableDate[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function MonthCalendarPicker({ availableDates, selectedDate, onSelectDate }: MonthCalendarPickerProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("en") ? enUS : de;
  const initialMonth = useMemo(() => {
    if (availableDates.length > 0) {
      return startOfMonth(parseISO(availableDates[0].available_date));
    }
    return startOfMonth(new Date());
  }, [availableDates]);

  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  const availableDateSet = useMemo(() => {
    return new Set(availableDates.map((d) => d.available_date));
  }, [availableDates]);

  const { minMonth, maxMonth } = useMemo(() => {
    if (availableDates.length === 0) return { minMonth: currentMonth, maxMonth: currentMonth };
    const first = startOfMonth(parseISO(availableDates[0].available_date));
    const last = startOfMonth(parseISO(availableDates[availableDates.length - 1].available_date));
    return { minMonth: first, maxMonth: last };
  }, [availableDates, currentMonth]);

  const canGoPrev = currentMonth > minMonth;
  const canGoNext = currentMonth < maxMonth;

  // Count available dates in current month
  const availableInMonth = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return availableDates.filter((d) => {
      const date = parseISO(d.available_date);
      return date >= monthStart && date <= monthEnd;
    }).length;
  }, [availableDates, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = (getDay(monthStart) + 6) % 7;
    const padding = Array.from({ length: startDayOfWeek }, () => null);
    return [...padding, ...days];
  }, [currentMonth]);

  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={!canGoPrev}
          className="h-9 w-9 p-0 rounded-full hover:bg-primary/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h4 className="font-display text-base font-semibold text-foreground capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: dateLocale })}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {availableInMonth} {availableInMonth === 1 ? t("scheduleSlots.termin_one") : t("scheduleSlots.termin_other")} {t("scheduleSlots.available")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          disabled={!canGoNext}
          className="h-9 w-9 p-0 rounded-full hover:bg-primary/10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider py-1.5">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`pad-${index}`} className="aspect-square" />;
          }

          const dateStr = format(day, "yyyy-MM-dd");
          const isAvailable = availableDateSet.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const todayDate = isToday(day);

          if (!isAvailable) {
            return (
              <div key={dateStr} className="aspect-square flex items-center justify-center">
                <span className="text-xs text-muted-foreground/20">{format(day, "d")}</span>
              </div>
            );
          }

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`aspect-square rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200 relative ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-lg scale-105"
                  : "bg-primary/10 text-foreground hover:bg-primary/25 hover:scale-105"
              } ${todayDate && !isSelected ? "ring-2 ring-primary/30" : ""}`}
            >
              {format(day, "d")}
              {todayDate && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
