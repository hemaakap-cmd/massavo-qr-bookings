import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Hotel as HotelIcon,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface RescheduleRow {
  id: string;
  reschedule_id: string;
  notification_type: string;
  delivery_channel: string;
  delivery_status: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  venue_type: string | null;
  booking_reschedules?: {
    booking_id: string;
    bookings?: {
      gym_id: string | null;
      hotel_id: string | null;
      booking_date: string | null;
      booking_time: string | null;
      customer_name: string | null;
      gyms?: { name: string; country_id?: string | null } | null;
      hotels?: { name: string; country_id?: string | null } | null;
    } | null;
  } | null;
}

interface Props {
  countryId?: string;
}

export function RescheduleNotificationsTab({ countryId }: Props) {
  const [rows, setRows] = useState<RescheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState("all");
  const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
  const [hotels, setHotels] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let gymQ = supabase.from("gyms").select("id, name").order("name");
    let hotelQ = supabase.from("hotels").select("id, name").order("name");
    if (countryId) {
      gymQ = gymQ.eq("country_id", countryId);
      hotelQ = hotelQ.eq("country_id", countryId);
    }
    Promise.all([gymQ, hotelQ]).then(([g, h]) => {
      setGyms(g.data || []);
      setHotels(h.data || []);
    });
  }, [countryId]);

  useEffect(() => {
    setLoading(true);
    (supabase as any)
      .from("reschedule_notifications")
      .select(
        `*, booking_reschedules:reschedule_id(
          booking_id,
          bookings:booking_id(
            gym_id, hotel_id, booking_date, booking_time, customer_name,
            gyms:gym_id(name, country_id),
            hotels:hotel_id(name, country_id)
          )
        )`,
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }: any) => {
        setRows((data || []) as RescheduleRow[]);
        setLoading(false);
      });
  }, [countryId]);

  const filtered = rows.filter((r) => {
    const b = r.booking_reschedules?.bookings;
    if (!b) return false;
    if (countryId) {
      const c = b.gyms?.country_id || b.hotels?.country_id;
      if (c && c !== countryId) return false;
    }
    if (venueFilter === "all") return true;
    const [t, id] = venueFilter.split(":");
    if (t === "gym") return b.gym_id === id;
    if (t === "hotel") return b.hotel_id === id;
    return true;
  });

  const statusColor = (s: string) =>
    s === "sent" || s === "delivered"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : s === "failed"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Filter
        </span>
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger className="w-52 h-8 text-xs bg-background">
            <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {gyms.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3" /> Gyms
                </SelectLabel>
                {gyms.map((g) => (
                  <SelectItem key={`gym:${g.id}`} value={`gym:${g.id}`}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {hotels.length > 0 && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5">
                  <HotelIcon className="w-3 h-3" /> Hotels
                </SelectLabel>
                {hotels.map((h) => (
                  <SelectItem key={`hotel:${h.id}`} value={`hotel:${h.id}`}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} notifications
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-8 h-8 opacity-40" />
          <p className="text-sm">No reschedule notifications.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((r) => {
            const b = r.booking_reschedules?.bookings;
            const isHotel = !!b?.hotel_id;
            const venueName = b?.hotels?.name || b?.gyms?.name || "—";
            const VenueIcon = isHotel ? HotelIcon : Building2;
            const ChannelIcon =
              r.delivery_channel === "email" ? Mail : MessageSquare;

            return (
              <div
                key={r.id}
                className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-card/60 border-border/50 hover:bg-card transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {r.notification_type}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase ${statusColor(r.delivery_status)}`}
                    >
                      {r.delivery_status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <ChannelIcon className="w-3 h-3" />
                      {r.delivery_channel}
                    </Badge>
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground font-medium">
                      {format(new Date(r.created_at), "dd.MM HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {b?.customer_name || r.recipient_email || "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <VenueIcon className="w-3 h-3" />
                      {venueName}
                    </span>
                    {b?.booking_date && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(b.booking_date), "dd.MM.yyyy")}{" "}
                        {b.booking_time?.slice(0, 5)}
                      </span>
                    )}
                    {r.recipient_email && <span>{r.recipient_email}</span>}
                  </div>
                  {r.error_message && (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-500 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {r.error_message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RescheduleNotificationsTab;