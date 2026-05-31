import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Hotel, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HotelLite {
  id: string;
  name: string;
}

export function TherapistHotelAssignments({ therapistId }: { therapistId: string }) {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { toast } = useToast();
  const [hotels, setHotels] = useState<HotelLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("hotels").select("id, name").eq("is_active", true).order("name");
      if (selectedCountry?.id) q = q.eq("country_id", selectedCountry.id);
      const [{ data: hs }, { data: links }] = await Promise.all([
        q,
        supabase.from("therapist_hotels").select("hotel_id, is_primary").eq("therapist_id", therapistId),
      ]);
      setHotels((hs as HotelLite[]) || []);
      const sel = new Set<string>();
      let prim: string | null = null;
      (links || []).forEach((l: any) => {
        sel.add(l.hotel_id);
        if (l.is_primary) prim = l.hotel_id;
      });
      setSelected(sel);
      setPrimaryId(prim);
      setLoading(false);
    })();
  }, [therapistId, selectedCountry?.id]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
      if (primaryId === id) setPrimaryId(null);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("therapist_hotels").select("hotel_id").eq("therapist_id", therapistId);
      const existingSet = new Set((existing || []).map((e: any) => e.hotel_id));
      const toAdd = Array.from(selected).filter((id) => !existingSet.has(id));
      const toRemove = Array.from(existingSet).filter((id) => !selected.has(id));
      if (toRemove.length > 0) {
        await supabase.from("therapist_hotels").delete()
          .eq("therapist_id", therapistId).in("hotel_id", toRemove);
      }
      if (toAdd.length > 0) {
        await supabase.from("therapist_hotels").insert(
          toAdd.map((hotel_id) => ({ therapist_id: therapistId, hotel_id, is_primary: hotel_id === primaryId }))
        );
      }
      // Reset all primaries then set the one
      await supabase.from("therapist_hotels").update({ is_primary: false }).eq("therapist_id", therapistId);
      if (primaryId && selected.has(primaryId)) {
        await supabase.from("therapist_hotels").update({ is_primary: true })
          .eq("therapist_id", therapistId).eq("hotel_id", primaryId);
      }
      toast({ title: "Hotel assignments saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
        <Hotel className="w-4 h-4" /> Hotel Assignments
      </h4>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : hotels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hotels available in this country.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {hotels.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2 rounded border border-border/50">
                <Checkbox
                  id={`hotel-${h.id}`}
                  checked={selected.has(h.id)}
                  onCheckedChange={() => toggle(h.id)}
                />
                <Label htmlFor={`hotel-${h.id}`} className="flex-1 cursor-pointer text-sm">
                  {h.name}
                </Label>
                {selected.has(h.id) && (
                  <button
                    type="button"
                    onClick={() => setPrimaryId(primaryId === h.id ? null : h.id)}
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      primaryId === h.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {primaryId === h.id ? "Primary" : "Set primary"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Hotel Assignments"}
          </Button>
        </>
      )}
    </div>
  );
}
