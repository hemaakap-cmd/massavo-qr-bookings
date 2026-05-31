import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Clock, ExternalLink, Building2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StaffAssignment } from "@/hooks/useStaffAssignment";

interface StaffLocationCardProps {
  assignment: StaffAssignment | null;
  dateLabel: string;
}

export function StaffLocationCard({ assignment, dateLabel }: StaffLocationCardProps) {
  const { t } = useTranslation();
  if (!assignment || !assignment.gym) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("staff.locationCard.noGym", { date: dateLabel })}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {t("staff.locationCard.contactIfError")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { gym } = assignment;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gym.address)}`;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground text-sm">
                    {gym.name}
                  </h3>
                  <Badge variant="outline" className="text-[10px] py-0 border-primary/40 text-primary">
                    {t("staff.locationCard.assigned")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{dateLabel}</p>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="underline-offset-2 hover:underline">{gym.address}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
              </a>

              {gym.phone && (
                <a
                  href={`tel:${gym.phone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{gym.phone}</span>
                </a>
              )}

              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {assignment.start_time?.slice(0, 5)} – {assignment.end_time?.slice(0, 5)}
                </span>
              </div>
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" />
            {t("staff.locationCard.map")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
