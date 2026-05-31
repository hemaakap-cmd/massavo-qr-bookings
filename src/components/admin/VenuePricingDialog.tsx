import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Tag, Sparkles, Loader2 } from "lucide-react";

type VenueType = "gym" | "hotel";

interface VenuePricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueType: VenueType;
  venueId: string;
  venueName: string;
  countryId: string | null;
  currencySymbol?: string;
}

interface PricingRow {
  service_id: string;
  service_name: string;
  duration_minutes: number;
  base_price: number;
  assignment_id: string | null;
  is_active: boolean;
  custom_price: string;
  promo_price: string;
  promo_starts_at: string;
  promo_ends_at: string;
  promo_label: string;
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (v: string): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export const VenuePricingDialog = ({
  open, onOpenChange, venueType, venueId, venueName, countryId, currencySymbol = "€",
}: VenuePricingDialogProps) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const table = venueType === "gym" ? "gym_services" : "hotel_services";
  const fkCol = venueType === "gym" ? "gym_id" : "hotel_id";

  useEffect(() => {
    if (!open || !venueId) return;
    const load = async () => {
      setLoading(true);
      let svcQ = supabase
        .from("services")
        .select("id, name, duration_minutes, price, is_active")
        .eq("is_active", true)
        .order("duration_minutes");
      if (countryId) svcQ = svcQ.eq("country_id", countryId);

      const [svcRes, assignRes] = await Promise.all([
        svcQ,
        (supabase.from(table as any) as any).select("*").eq(fkCol, venueId),
      ]);

      const assignMap = new Map<string, any>(
        (assignRes.data || []).map((a: any) => [a.service_id, a])
      );

      const next: PricingRow[] = (svcRes.data || []).map((s: any) => {
        const a = assignMap.get(s.id);
        return {
          service_id: s.id,
          service_name: s.name,
          duration_minutes: s.duration_minutes,
          base_price: Number(s.price),
          assignment_id: a?.id ?? null,
          is_active: a ? !!a.is_active : false,
          custom_price: a?.custom_price != null ? String(a.custom_price) : "",
          promo_price: a?.promo_price != null ? String(a.promo_price) : "",
          promo_starts_at: toLocalInput(a?.promo_starts_at ?? null),
          promo_ends_at: toLocalInput(a?.promo_ends_at ?? null),
          promo_label: a?.promo_label ?? "",
        };
      });
      setRows(next);
      setLoading(false);
    };
    load();
  }, [open, venueId, countryId, table, fkCol]);

  const update = (id: string, patch: Partial<PricingRow>) =>
    setRows((prev) => prev.map((r) => (r.service_id === id ? { ...r, ...patch } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const r of rows) {
        const payload: any = {
          [fkCol]: venueId,
          service_id: r.service_id,
          is_active: r.is_active,
          custom_price: r.custom_price.trim() === "" ? null : Number(r.custom_price),
          promo_price: r.promo_price.trim() === "" ? null : Number(r.promo_price),
          promo_starts_at: fromLocalInput(r.promo_starts_at),
          promo_ends_at: fromLocalInput(r.promo_ends_at),
          promo_label: r.promo_label.trim() || null,
        };

        if (r.assignment_id) {
          const { error } = await (supabase.from(table as any) as any)
            .update(payload)
            .eq("id", r.assignment_id);
          if (error) throw error;
        } else if (
          r.is_active || payload.custom_price != null || payload.promo_price != null
        ) {
          const { error } = await (supabase.from(table as any) as any).insert(payload);
          if (error) throw error;
        }
      }
      toast({ title: "Pricing updated", description: `${venueName} – prices saved.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" /> Pricing – {venueName}
          </DialogTitle>
          <DialogDescription>
            Set a custom price per service for this location. Add an optional
            promotional price with a date window for seasonal offers.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading services…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No services available for this country.</p>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div
                key={r.service_id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">{r.service_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.duration_minutes} min · Base {currencySymbol}{r.base_price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-xs text-muted-foreground">Offered</Label>
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => update(r.service_id, { is_active: v })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Custom price ({currencySymbol})</Label>
                    <Input
                      type="number" step="0.01" min="0"
                      placeholder={`Default ${r.base_price.toFixed(2)}`}
                      value={r.custom_price}
                      onChange={(e) => update(r.service_id, { custom_price: e.target.value })}
                      disabled={!r.is_active}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Promo price ({currencySymbol})
                    </Label>
                    <Input
                      type="number" step="0.01" min="0"
                      placeholder="optional"
                      value={r.promo_price}
                      onChange={(e) => update(r.service_id, { promo_price: e.target.value })}
                      disabled={!r.is_active}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Promo starts</Label>
                    <Input
                      type="datetime-local"
                      value={r.promo_starts_at}
                      onChange={(e) => update(r.service_id, { promo_starts_at: e.target.value })}
                      disabled={!r.is_active || !r.promo_price}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Promo ends</Label>
                    <Input
                      type="datetime-local"
                      value={r.promo_ends_at}
                      onChange={(e) => update(r.service_id, { promo_ends_at: e.target.value })}
                      disabled={!r.is_active || !r.promo_price}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Promo label</Label>
                    <Input
                      placeholder="e.g. Summer Special"
                      maxLength={40}
                      value={r.promo_label}
                      onChange={(e) => update(r.service_id, { promo_label: e.target.value })}
                      disabled={!r.is_active || !r.promo_price}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VenuePricingDialog;