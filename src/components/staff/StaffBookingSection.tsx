import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffBookingCard } from "@/components/staff/StaffBookingCard";
import type { StaffBooking } from "@/hooks/useStaffBookings";
import { LucideIcon } from "lucide-react";

interface StaffBookingSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  bookings: StaffBooking[];
  emptyMessage: string;
  highlightedId: string | null;
  onMarkCompleted: (id: string) => void;
  onMarkNoShow: (id: string) => void;
  onSelectBooking: (id: string) => void;
  isUpdating: boolean;
  maxItems?: number;
}

export function StaffBookingSection({
  title,
  icon: Icon,
  iconColor = "text-primary",
  bookings,
  emptyMessage,
  highlightedId,
  onMarkCompleted,
  onMarkNoShow,
  onSelectBooking,
  isUpdating,
  maxItems,
}: StaffBookingSectionProps) {
  const items = maxItems ? bookings.slice(0, maxItems) : bookings;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconColor}`} />
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">({bookings.length})</span>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((b) => (
            <div
              key={b.id}
              onClick={() => onSelectBooking(b.id)}
              className={`cursor-pointer transition-all duration-300 ${
                highlightedId === b.id
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg scale-[1.01]"
                  : ""
              }`}
            >
              <StaffBookingCard
                booking={b}
                onMarkCompleted={onMarkCompleted}
                onMarkNoShow={onMarkNoShow}
                isUpdating={isUpdating}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
