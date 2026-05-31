import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

import {
  Building2, Hotel, MapPin, Clock, ChevronRight, Star, CalendarDays,
  ChevronLeft, ChevronRight as ChevronRightIcon, Calendar, Plane,
} from "lucide-react";
import {
  format, addDays, startOfWeek, endOfWeek, isSameDay, isToday, isPast, subDays,
} from "date-fns";
import { de as dfDe, enUS as dfEnUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import type { VenueType } from "@/lib/venueUtils";

export interface StaffWorkingDay {
  date: string;           // yyyy-MM-dd
  venueType: VenueType;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venuePhone: string | null;
  startTime: string;
  endTime: string;
  isPrimary: boolean;
  onLeave?: boolean;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

interface Props {
  onSelectDay: (day: StaffWorkingDay) => void;
}

export function StaffWorkingDays({ onSelectDay }: Props) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const dfLocale = i18n.language?.startsWith("de") ? dfDe : dfEnUS;
  const [weekOffset, setWeekOffset] = useState(0);

  // Navigate weeks: 0 = current week, -1 = last week, 1 = next week, etc.
  const range = useMemo(() => {
    const baseDate = addDays(new Date(), weekOffset * 14);
    const start = startOfWeek(baseDate, { weekStartsOn: 1 });
    const end = endOfWeek(addDays(start, 13), { weekStartsOn: 1 });
    return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), startDate: start, endDate: end };
  }, [weekOffset]);

  const { data: workingDays = [], isLoading } = useQuery({
    queryKey: ["staff-working-days", user?.id, range.from, range.to],
    enabled: !!user,
    queryFn: async () => {
      const { data: therapist } = await supabase
        .from("therapists")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!therapist) return [];

      // Approved leaves that overlap this range — used to flag affected days.
      const { data: leaves } = await (supabase as any)
        .from("therapist_leaves")
        .select("start_date, end_date, status")
        .eq("therapist_id", therapist.id)
        .eq("status", "approved")
        .lte("start_date", range.to)
        .gte("end_date", range.from);
      const onLeave = (dateStr: string) =>
        (leaves || []).some(
          (l: any) => dateStr >= l.start_date && dateStr <= l.end_date,
        );

      const { data: schedules } = await supabase
        .from("therapist_weekly_schedules")
        .select(
          "id, day_of_week, start_time, end_time, is_primary, gym_id, hotel_id, gyms:gym_id(id, name, address, phone), hotels:hotel_id(id, name, address, phone)"
        )
        .eq("therapist_id", therapist.id)
        .eq("is_active", true);

      // Also pull venues assigned via the unified Venue Assignments panel
      // so that gyms/hotels added there appear even without a custom weekly row.
      const { data: venueLinks } = await (supabase as any)
        .from("therapist_venues")
        .select("venue_type, venue_id, is_primary")
        .eq("therapist_id", therapist.id)
        .eq("is_active", true);

      const linkedGymIds = (venueLinks || [])
        .filter((v: any) => v.venue_type === "gym")
        .map((v: any) => v.venue_id as string);
      const linkedHotelIds = (venueLinks || [])
        .filter((v: any) => v.venue_type === "hotel")
        .map((v: any) => v.venue_id as string);
      const primaryKey = new Set(
        (venueLinks || [])
          .filter((v: any) => v.is_primary)
          .map((v: any) => `${v.venue_type}:${v.venue_id}`),
      );

      // Fetch venue details for any unified-link venue not already covered by a schedule.
      const scheduleGymIds = new Set((schedules || []).map((s: any) => s.gym_id).filter(Boolean));
      const scheduleHotelIds = new Set((schedules || []).map((s: any) => s.hotel_id).filter(Boolean));
      const extraGymIds = linkedGymIds.filter((id) => !scheduleGymIds.has(id));
      const extraHotelIds = linkedHotelIds.filter((id) => !scheduleHotelIds.has(id));

      const [extraGymsRes, extraHotelsRes] = await Promise.all([
        extraGymIds.length
          ? supabase.from("gyms").select("id, name, address, phone").in("id", extraGymIds)
          : Promise.resolve({ data: [] as any[] }),
        extraHotelIds.length
          ? (supabase as any).from("hotels").select("id, name, address, phone").in("id", extraHotelIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const extraVenues: Array<{ type: VenueType; v: any }> = [
        ...((extraGymsRes.data || []) as any[]).map((v) => ({ type: "gym" as VenueType, v })),
        ...((extraHotelsRes.data || []) as any[]).map((v) => ({ type: "hotel" as VenueType, v })),
      ];

      if ((!schedules || schedules.length === 0) && extraVenues.length === 0) return [];

      const results: StaffWorkingDay[] = [];
      for (let d = new Date(range.startDate); d <= range.endDate; d.setDate(d.getDate() + 1)) {
        const dayName = DAY_NAMES[d.getDay()];
        const dateStr = format(d, "yyyy-MM-dd");
        const leaveToday = onLeave(dateStr);

        (schedules || [])
          .filter((s) => s.day_of_week === dayName)
          .forEach((s: any) => {
            const venue = s.hotels || s.gyms;
            if (!venue) return;
            const venueType: VenueType = s.hotel_id ? "hotel" : "gym";
            results.push({
              date: dateStr,
              venueType,
              venueId: venue.id,
              venueName: venue.name,
              venueAddress: venue.address,
              venuePhone: venue.phone,
              startTime: s.start_time,
              endTime: s.end_time,
              isPrimary: s.is_primary || false,
              onLeave: leaveToday,
            });
          });

        // For unified-link venues without a weekly schedule, surface them on
        // weekdays (Mon–Fri) with a generic 09:00–17:00 window so the
        // therapist still sees the assignment until a real schedule is set.
        const isWeekday = d.getDay() >= 1 && d.getDay() <= 5;
        if (isWeekday) {
          extraVenues.forEach(({ type, v }) => {
            results.push({
              date: dateStr,
              venueType: type,
              venueId: v.id,
              venueName: v.name,
              venueAddress: v.address,
              venuePhone: v.phone ?? null,
              startTime: "09:00:00",
              endTime: "17:00:00",
              isPrimary: primaryKey.has(`${type}:${v.id}`),
              onLeave: leaveToday,
            });
          });
        }
      }

      // Return all days in the range (no past filtering — therapist can browse any period)
      return results;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t("staff.workingDays.title")}</h1>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (workingDays.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <CalendarDays className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{t("staff.workingDays.noUpcoming")}</p>
        <p className="text-xs text-muted-foreground/70">{t("staff.workingDays.contactManager")}</p>
      </div>
    );
  }

  // Group by date for display
  const grouped = workingDays.reduce<Record<string, StaffWorkingDay[]>>((acc, day) => {
    (acc[day.date] = acc[day.date] || []).push(day);
    return acc;
  }, {});

  const rangeLabel = `${format(new Date(range.from + "T00:00:00"), "dd MMM", { locale: dfLocale })} – ${format(new Date(range.to + "T00:00:00"), "dd MMM yyyy", { locale: dfLocale })}`;

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{t("staff.workingDays.title")}</h1>
        </div>
      </div>

      {/* Date range navigator */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-3 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <button
          onClick={() => setWeekOffset(0)}
          className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
        >
          <Calendar className="w-3.5 h-3.5" />
          {rangeLabel}
        </button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </div>

      {weekOffset !== 0 && (
        <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setWeekOffset(0)}>
          {t("staff.workingDays.backToToday")}
        </Button>
      )}

      {Object.entries(grouped).map(([dateStr, days]) => {
        const dateObj = new Date(dateStr + "T00:00:00");
        const today = isToday(dateObj);

        return (
          <div key={dateStr} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {format(dateObj, "EEEE, dd MMM", { locale: dfLocale })}
              </span>
              {today && (
                <Badge className="text-[10px] py-0 bg-primary text-primary-foreground">{t("staff.workingDays.today")}</Badge>
              )}
            </div>

            {days.map((day, idx) => (
              <Card
                key={`${day.venueType}-${day.venueId}-${idx}`}
                className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.99] ${
                  day.onLeave
                    ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20"
                    : today ? "border-primary/30 bg-primary/5" : "hover:border-primary/20"
                }`}
                onClick={() => onSelectDay(day)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {day.venueType === "hotel" ? (
                      <Hotel className="h-5 w-5 text-primary" />
                    ) : (
                      <Building2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">{day.venueName}</span>
                      <Badge
                        variant="outline"
                        className="text-[9px] py-0 h-4 px-1.5 capitalize border-muted-foreground/30 text-muted-foreground"
                      >
                        {day.venueType}
                      </Badge>
                      {day.isPrimary && (
                        <Star className="w-3 h-3 text-primary fill-primary shrink-0" />
                      )}
                      {day.onLeave && (
                        <Badge className="text-[9px] py-0 h-4 px-1.5 bg-amber-500 text-white gap-1">
                          <Plane className="w-2.5 h-2.5" /> {t("staff.workingDays.onLeave")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {day.startTime.slice(0, 5)} – {day.endTime.slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{day.venueAddress}</span>
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
