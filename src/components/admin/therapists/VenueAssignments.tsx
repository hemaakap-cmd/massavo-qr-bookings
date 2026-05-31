import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTherapistVenues, type TherapistVenueLink } from "@/hooks/useTherapistVenues";
import { listShippableVenueTypes, getVenueConfig } from "@/domain/venue/registry";
import type { VenueType } from "@/domain/venue/types";

interface VenueOption {
  id: string;
  name: string;
  type: VenueType;
}

/**
 * Unified venue assignment panel — replaces the per-type list pickers.
 * One therapist can be assigned to any number of venues across any types
 * (gym, hotel, clinic, …) with a single Primary across all of them.
 */
export function VenueAssignments({ therapistId }: { therapistId: string }) {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { toast } = useToast();
  const { links, groupedByType, isLoading, assign, remove, setPrimary } =
    useTherapistVenues(therapistId);

  const [options, setOptions] = useState<VenueOption[]>([]);
  const [pickerType, setPickerType] = useState<VenueType>("gym");
  const [pickerVenueId, setPickerVenueId] = useState<string>("");

  const shippableTypes = useMemo(() => listShippableVenueTypes(), []);

  useEffect(() => {
    (async () => {
      const cid = selectedCountry?.id;
      if (!cid) return setOptions([]);
      const [gyms, hotels] = await Promise.all([
        supabase.from("gyms").select("id, name").eq("country_id", cid).order("name"),
        supabase.from("hotels" as any).select("id, name").eq("country_id", cid).order("name"),
      ]);
      const merged: VenueOption[] = [
        ...((gyms.data || []) as any[]).map((g) => ({ id: g.id, name: g.name, type: "gym" as VenueType })),
        ...((hotels.data || []) as any[]).map((h) => ({ id: h.id, name: h.name, type: "hotel" as VenueType })),
      ];
      setOptions(merged);
    })();
  }, [selectedCountry?.id]);

  const linkedKeys = new Set(links.map((l) => `${l.venue_type}:${l.venue_id}`));
  const availableForType = options.filter(
    (o) => o.type === pickerType && !linkedKeys.has(`${o.type}:${o.id}`),
  );

  const handleAdd = async () => {
    if (!pickerVenueId) return;
    try {
      await assign.mutateAsync({ venueType: pickerType, venueId: pickerVenueId });
      setPickerVenueId("");
      toast({ title: "Venue assigned" });
    } catch (e: any) {
      toast({ title: "Failed to assign", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (link: TherapistVenueLink) => {
    try {
      await remove.mutateAsync(link);
      toast({ title: "Venue removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove", description: e.message, variant: "destructive" });
    }
  };

  const handleSetPrimary = async (link: TherapistVenueLink) => {
    try {
      await setPrimary.mutateAsync(link);
      toast({ title: "Primary venue updated" });
    } catch (e: any) {
      toast({ title: "Failed to update primary", description: e.message, variant: "destructive" });
    }
  };

  const venueName = (l: TherapistVenueLink) =>
    options.find((o) => o.type === l.venue_type && o.id === l.venue_id)?.name || l.venue_id.slice(0, 8);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Venue Assignments</h4>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        A therapist can serve any number of venues across types — gym, hotel, and more.
      </p>

      {/* Add venue picker */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={pickerType} onValueChange={(v) => { setPickerType(v as VenueType); setPickerVenueId(""); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {shippableTypes.map((c) => (
                <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Venue</Label>
          <Select value={pickerVenueId} onValueChange={setPickerVenueId}>
            <SelectTrigger><SelectValue placeholder={availableForType.length ? "Select…" : "No venues available"} /></SelectTrigger>
            <SelectContent>
              {availableForType.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={handleAdd} disabled={!pickerVenueId || assign.isPending}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* Grouped lists */}
      <div className="space-y-3">
        {shippableTypes.map((cfg) => {
          const rows = groupedByType[cfg.type] || [];
          if (rows.length === 0) return null;
          const Icon = cfg.icon;
          return (
            <div key={cfg.type} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {cfg.terminology.plural}
              </div>
              <div className="space-y-1.5">
                {rows.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{venueName(l)}</span>
                      {l.is_primary && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" /> Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!l.is_primary && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleSetPrimary(l)}>
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleRemove(l)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {links.length === 0 && !isLoading && (
          <p className="text-xs text-muted-foreground italic">No venues assigned yet.</p>
        )}
      </div>
    </div>
  );
}