import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useCountryData } from "@/hooks/useCountry";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Hotel as HotelIcon, ChevronDown, ChevronUp, MapPin, Layers, List, QrCode, Tag } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import HotelQRCode from "@/components/hotel/HotelQRCode";
import { VenuePricingDialog } from "@/components/admin/VenuePricingDialog";

interface Hotel {
  id: string;
  city_id: string;
  country_id: string | null;
  name: string;
  address: string;
  phone: string | null;
  qr_code_id: string;
  image_url: string | null;
  star_rating: number | null;
  open_hours: string | null;
  is_active: boolean;
}

interface City {
  id: string;
  name: string;
  country_id: string | null;
}

const emptyForm = {
  city_id: "",
  name: "",
  address: "",
  phone: "",
  image_url: "",
  star_rating: "",
  open_hours: "",
  is_active: true,
  generate_qr: true,
};

const AdminHotels = () => {
  const { t } = useTranslation();
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const activeCountryId = selectedCountry?.id || null;

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grouped" | "table">("grouped");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [qrHotel, setQrHotel] = useState<Hotel | null>(null);
  const [qrAutoOpen, setQrAutoOpen] = useState(false);
  const [pricingHotel, setPricingHotel] = useState<Hotel | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    let hotelsQ = supabase.from("hotels").select("*").order("name");
    let citiesQ = supabase.from("cities").select("id, name, country_id").eq("is_active", true).order("name");
    if (activeCountryId) {
      hotelsQ = hotelsQ.eq("country_id", activeCountryId);
      citiesQ = citiesQ.eq("country_id", activeCountryId);
    }
    const [hRes, cRes] = await Promise.all([hotelsQ, citiesQ]);
    setHotels((hRes.data || []) as Hotel[]);
    setCities((cRes.data || []) as City[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [activeCountryId]);

  const filteredHotels = hotels.filter((h) => {
    if (cityFilter !== "all" && h.city_id !== cityFilter) return false;
    if (activeFilter === "active" && !h.is_active) return false;
    if (activeFilter === "inactive" && h.is_active) return false;
    return true;
  });

  // Group filtered hotels by city
  const groupedByCity = (() => {
    const map = new Map<string, Hotel[]>();
    filteredHotels.forEach((h) => {
      const key = h.city_id || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(h);
    });
    // Order by city name (alphabetical), unknown city last
    const cityNameOf = (id: string) =>
      id === "__none__" ? "" : (cities.find((c) => c.id === id)?.name || "");
    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === "__none__") return 1;
        if (b[0] === "__none__") return -1;
        return cityNameOf(a[0]).localeCompare(cityNameOf(b[0]));
      });
  })();

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (h: Hotel) => {
    setEditing(h);
    setForm({
      city_id: h.city_id,
      name: h.name,
      address: h.address,
      phone: h.phone || "",
      image_url: h.image_url || "",
      star_rating: h.star_rating?.toString() || "",
      open_hours: h.open_hours || "",
      is_active: h.is_active,
      generate_qr: true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city_id || !form.name || !form.address) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    const payload: any = {
      city_id: form.city_id,
      country_id: activeCountryId,
      name: form.name,
      address: form.address,
      phone: form.phone || null,
      image_url: form.image_url || null,
      star_rating: form.star_rating ? parseInt(form.star_rating) : null,
      open_hours: form.open_hours || null,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("hotels").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Updated" });
      setDialogOpen(false);
      fetchData();
    } else {
      const { data, error } = await supabase.from("hotels").insert(payload).select("*").single();
      if (error || !data) {
        toast({ title: "Error", description: error?.message || "Insert failed", variant: "destructive" });
        return;
      }
      toast({
        title: "Created",
        description: form.generate_qr
          ? "Statischer QR-Code wurde für diesen Standort generiert."
          : "Hotel gespeichert.",
      });
      setDialogOpen(false);
      if (form.generate_qr) {
        setQrHotel(data as Hotel);
        setQrAutoOpen(true);
      }
      fetchData();
    }
  };

  const handleDelete = async (h: Hotel) => {
    if (!confirm(t("adminHotels.confirmDelete"))) return;
    const { error } = await supabase.from("hotels").delete().eq("id", h.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    fetchData();
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HotelIcon className="w-6 h-6" />
              {t("adminHotels.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{t("adminHotels.subtitle")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" />
                {t("adminHotels.addHotel")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? t("adminHotels.editHotel") : t("adminHotels.addHotel")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <Label>{t("adminHotels.name")}</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <Label>{t("adminHotels.city")}</Label>
                  <Select value={form.city_id} onValueChange={(v) => setForm({ ...form, city_id: v })}>
                    <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminHotels.address")}</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("adminHotels.phone")}</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("adminHotels.starRating")}</Label>
                    <Input type="number" min={1} max={5} value={form.star_rating} onChange={(e) => setForm({ ...form, star_rating: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>{t("adminHotels.openHours")}</Label>
                  <Input value={form.open_hours} onChange={(e) => setForm({ ...form, open_hours: e.target.value })} />
                </div>
                <div>
                  <Label>{t("adminHotels.imageUrl")}</Label>
                  <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>{t("adminHotels.active")}</Label>
                </div>
                {!editing && (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="generate-qr-hotel" className="text-sm font-semibold cursor-pointer">
                            Generate Static QR Code for this Location
                          </Label>
                          <Switch
                            id="generate-qr-hotel"
                            checked={form.generate_qr}
                            onCheckedChange={(v) => setForm({ ...form, generate_qr: v })}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Erstellt einen permanenten QR-Code, der ausschließlich mit diesem Hotel verknüpft ist. Gäste scannen ihn vor Ort, um die Buchungsseite und Preise freizuschalten.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("adminHotels.cancel")}
                  </Button>
                  <Button type="submit">{t("adminHotels.save")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            {t("adminHotels.filters") || "Filters"}
          </span>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-44 h-8 text-xs bg-background">
              <SelectValue placeholder={t("adminHotels.allCities") || "All cities"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminHotels.allCities") || "All cities"}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminHotels.allStatus") || "All status"}</SelectItem>
              <SelectItem value="active">{t("adminHotels.active") || "Active"}</SelectItem>
              <SelectItem value="inactive">{t("adminHotels.inactive") || "Inactive"}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 ml-2 rounded-md border border-border/60 bg-background p-0.5">
            <Button
              type="button"
              variant={view === "grouped" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setView("grouped")}
            >
              <Layers className="w-3.5 h-3.5 mr-1" />
              {t("adminHotels.viewGrouped")}
            </Button>
            <Button
              type="button"
              variant={view === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setView("table")}
            >
              <List className="w-3.5 h-3.5 mr-1" />
              {t("adminHotels.viewTable")}
            </Button>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredHotels.length} / {hotels.length}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">{t("adminHotels.noHotels")}</div>
        ) : view === "table" ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminHotels.name")}</TableHead>
                  <TableHead>{t("adminHotels.city") || "City"}</TableHead>
                  <TableHead>{t("adminHotels.address")}</TableHead>
                  <TableHead>{t("adminHotels.starRating")}</TableHead>
                  <TableHead>{t("adminHotels.active")}</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHotels.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {cities.find((c) => c.id === h.city_id)?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{h.address}</TableCell>
                    <TableCell>{h.star_rating || "—"}</TableCell>
                    <TableCell>{h.is_active ? "✓" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setQrHotel(h); setQrAutoOpen(true); }}>
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Pricing" onClick={() => { setPricingHotel(h); setPricingOpen(true); }}>
                        <Tag className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(h)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={groupedByCity.slice(0, 3).map(([k]) => k)} className="space-y-2">
            {groupedByCity.map(([cityId, cityHotels]) => {
              const cityName = cityId === "__none__"
                ? t("adminHotels.noCity")
                : (cities.find((c) => c.id === cityId)?.name || "—");
              return (
                <AccordionItem key={cityId} value={cityId} className="border border-border/60 rounded-lg bg-card/50 overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-sm">{cityName}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("adminHotels.hotelsCount", { count: cityHotels.length })}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("adminHotels.name")}</TableHead>
                          <TableHead>{t("adminHotels.address")}</TableHead>
                          <TableHead>{t("adminHotels.starRating")}</TableHead>
                          <TableHead>{t("adminHotels.active")}</TableHead>
                          <TableHead className="w-32"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cityHotels.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-medium">{h.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{h.address}</TableCell>
                            <TableCell>{h.star_rating || "—"}</TableCell>
                            <TableCell>{h.is_active ? "✓" : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setQrHotel(h); setQrAutoOpen(true); }}>
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Pricing" onClick={() => { setPricingHotel(h); setPricingOpen(true); }}>
                              <Tag className="w-4 h-4" />
                            </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(h)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        <Dialog open={qrAutoOpen} onOpenChange={setQrAutoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                QR-Code
              </DialogTitle>
            </DialogHeader>
            {qrHotel && (
              <HotelQRCode
                hotelId={qrHotel.id}
                hotelName={qrHotel.name}
                cityName={cities.find((c) => c.id === qrHotel.city_id)?.name}
              />
            )}
          </DialogContent>
        </Dialog>

        {pricingHotel && (
          <VenuePricingDialog
            open={pricingOpen}
            onOpenChange={(o) => { setPricingOpen(o); if (!o) setPricingHotel(null); }}
            venueType="hotel"
            venueId={pricingHotel.id}
            venueName={pricingHotel.name}
            countryId={pricingHotel.country_id ?? activeCountryId}
            currencySymbol={selectedCountry?.currency_symbol || "€"}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminHotels;