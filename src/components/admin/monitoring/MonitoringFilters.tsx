import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Filter, AlertTriangle, Hotel as HotelIcon, Layers } from "lucide-react";

interface MonitoringFiltersProps {
  countryId?: string;
  venueFilter: string;
  setVenueFilter: (v: string) => void;
  venueTypeFilter: string;
  setVenueTypeFilter: (v: string) => void;
  eventTypeFilter: string;
  setEventTypeFilter: (v: string) => void;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
}

export function MonitoringFilters({
  countryId,
  venueFilter,
  setVenueFilter,
  venueTypeFilter,
  setVenueTypeFilter,
  eventTypeFilter,
  setEventTypeFilter,
  severityFilter,
  setSeverityFilter,
}: MonitoringFiltersProps) {
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

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
        Filters
      </span>

      <Select value={venueTypeFilter} onValueChange={setVenueTypeFilter}>
        <SelectTrigger className="w-36 h-8 text-xs bg-background">
          <Layers className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Venues" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Venues</SelectItem>
          <SelectItem value="gym">Gyms only</SelectItem>
          <SelectItem value="hotel">Hotels only</SelectItem>
        </SelectContent>
      </Select>

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

      <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
        <SelectTrigger className="w-44 h-8 text-xs bg-background">
          <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          <SelectItem value="created">Created</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="rescheduled">Rescheduled</SelectItem>
          <SelectItem value="updated">Updated</SelectItem>
          <SelectItem value="payment_updated">Payment Updated</SelectItem>
          <SelectItem value="conflict_blocked">Conflict Blocked</SelectItem>
          <SelectItem value="payment_failed">Payment Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={severityFilter} onValueChange={setSeverityFilter}>
        <SelectTrigger className="w-36 h-8 text-xs bg-background">
          <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
          <SelectValue placeholder="All Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severity</SelectItem>
          <SelectItem value="info">Info</SelectItem>
          <SelectItem value="warning">Warning</SelectItem>
          <SelectItem value="error">Error</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
