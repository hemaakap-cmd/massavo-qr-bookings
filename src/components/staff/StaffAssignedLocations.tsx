import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Hotel, MapPin, Phone, Clock, ExternalLink, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import type { VenueType } from "@/lib/venueUtils";

interface VenueSchedule {
  venueType: VenueType;
  venueId: string;
  venueName: string;
  venueAddress: string;
  venuePhone: string | null;
  isPrimary: boolean;
  days: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }[];
}

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_KEY: Record<string, string> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
};

export function StaffAssignedLocations() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["staff-assigned-locations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: therapist } = await supabase
        .from("therapists")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!therapist) return [];

      const { data: schedules, error } = await supabase
        .from("therapist_weekly_schedules")
        .select(
          "id, day_of_week, start_time, end_time, is_primary, gym_id, hotel_id, gyms:gym_id(id, name, address, phone), hotels:hotel_id(id, name, address, phone)"
        )
        .eq("therapist_id", therapist.id)
        .eq("is_active", true);

      if (error) throw error;
      if (!schedules || schedules.length === 0) return [];

      // Group by venue (gym OR hotel) using a composite key
      const venueMap = new Map<string, VenueSchedule>();
      schedules.forEach((s: any) => {
        const venue = s.hotels || s.gyms;
        if (!venue) return;
        const venueType: VenueType = s.hotel_id ? "hotel" : "gym";
        const key = `${venueType}:${venue.id}`;
        if (!venueMap.has(key)) {
          venueMap.set(key, {
            venueType,
            venueId: venue.id,
            venueName: venue.name,
            venueAddress: venue.address,
            venuePhone: venue.phone,
            isPrimary: s.is_primary || false,
            days: [],
          });
        }
        const entry = venueMap.get(key)!;
        if (s.is_primary) entry.isPrimary = true;
        entry.days.push({
          dayOfWeek: s.day_of_week,
          startTime: s.start_time,
          endTime: s.end_time,
        });
      });

      const result = Array.from(venueMap.values());
      result.forEach(g => {
        g.days.sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));
      });
      // Primary venue first
      result.sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
      return result;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("staff.locations.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("staff.locations.none")}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t("staff.locations.contactManagerSchedule")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {t("staff.locations.title")}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {locations.map((loc) => {
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.venueAddress)}`;
          return (
            <Card
              key={`${loc.venueType}:${loc.venueId}`}
              className={loc.isPrimary ? "border-primary/30 bg-primary/5" : ""}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {loc.venueType === "hotel" ? (
                        <Hotel className="h-4.5 w-4.5 text-primary" />
                      ) : (
                        <Building2 className="h-4.5 w-4.5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">{loc.venueName}</h3>
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 h-4 px-1.5 capitalize border-muted-foreground/30 text-muted-foreground"
                        >
                          {loc.venueType}
                        </Badge>
                        {loc.isPrimary && (
                          <Badge className="text-[10px] py-0 bg-primary/20 text-primary border-primary/30">
                            <Star className="w-2.5 h-2.5 mr-0.5" />
                            {t("staff.workingDays.primary")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    <MapPin className="h-3 w-3" />
                    {t("staff.locationCard.map")}
                  </a>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{loc.venueAddress}</span>
                  </div>
                  {loc.venuePhone && (
                    <a href={`tel:${loc.venuePhone}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Phone className="w-3 h-3 shrink-0" />
                      <span>{loc.venuePhone}</span>
                    </a>
                  )}
                </div>

                {/* Weekly Schedule */}
                <div className="rounded-md bg-muted/50 p-2.5">
                  <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider mb-2">
                    {t("staff.locations.weeklySchedule")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {loc.days.map((d) => (
                      <div
                        key={d.dayOfWeek}
                        className="flex items-center gap-1 rounded-md bg-background px-2 py-1 text-xs border border-border"
                      >
                        <span className="font-semibold text-foreground">{t(`staff.locations.days.${DAY_KEY[d.dayOfWeek]}`)}</span>
                        <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {d.startTime.slice(0, 5)}–{d.endTime.slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
