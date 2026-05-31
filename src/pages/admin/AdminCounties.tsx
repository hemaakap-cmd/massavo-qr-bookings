import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Building } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

// Geographic terminology per country
const GEO_LABELS: Record<string, { singular: string; plural: string; parentSingular: string; parentPlural: string; addNew: string; codePlaceholder: string; namePlaceholder: string }> = {
  DE: { singular: "Landkreis", plural: "Landkreise", parentSingular: "Bundesland", parentPlural: "Bundesländer", addNew: "Neuer Landkreis", codePlaceholder: "z.B. RNK", namePlaceholder: "z.B. Rhein-Neckar-Kreis" },
  EG: { singular: "مركز / حي", plural: "المراكز والأحياء", parentSingular: "محافظة", parentPlural: "المحافظات", addNew: "إضافة مركز / حي", codePlaceholder: "مثال: NSR", namePlaceholder: "مثال: مدينة نصر" },
  SA: { singular: "محافظة", plural: "المحافظات", parentSingular: "منطقة", parentPlural: "المناطق", addNew: "إضافة محافظة", codePlaceholder: "مثال: JED", namePlaceholder: "مثال: جدة" },
};
const DEFAULT_LABELS = { singular: "District", plural: "Districts", parentSingular: "Region", parentPlural: "Regions", addNew: "Add District", codePlaceholder: "e.g. ABC", namePlaceholder: "e.g. District Name" };

interface County {
  id: string;
  name: string;
  code: string;
  federal_state_id: string;
  is_active: boolean;
}

interface FederalState {
  id: string;
  name: string;
  code: string;
}

const AdminCounties = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const activeCountryId = selectedCountry?.id || null;
  const countryCode = selectedCountry?.code || "DE";
  const labels = GEO_LABELS[countryCode] || DEFAULT_LABELS;

  const [counties, setCounties] = useState<County[]>([]);
  const [federalStates, setFederalStates] = useState<FederalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCounty, setEditingCounty] = useState<County | null>(null);
  const [filterStateId, setFilterStateId] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", code: "", federal_state_id: "", is_active: true });
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    let statesQuery = supabase.from("federal_states").select("*").eq("is_active", true).order("name");
    if (activeCountryId) statesQuery = statesQuery.eq("country_id", activeCountryId);

    const [statesRes] = await Promise.all([statesQuery]);

    if (!statesRes.error && statesRes.data) {
      setFederalStates(statesRes.data);

      // Fetch counties only for states belonging to this country
      const stateIds = statesRes.data.map((s: any) => s.id);
      if (stateIds.length > 0) {
        const { data: countiesData } = await supabase
          .from("counties")
          .select("*")
          .in("federal_state_id", stateIds)
          .order("name");
        setCounties(countiesData || []);
      } else {
        setCounties([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [activeCountryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCounty) {
      const { error } = await supabase.from("counties").update(formData).eq("id", editingCounty.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓", description: `${labels.singular} updated` });
        fetchData();
        setIsDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("counties").insert([formData]);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓", description: `${labels.singular} created` });
        fetchData();
        setIsDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete this ${labels.singular}?`)) return;
    const { error } = await supabase.from("counties").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓", description: `${labels.singular} deleted` });
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({ name: "", code: "", federal_state_id: "", is_active: true });
    setEditingCounty(null);
  };

  const openEditDialog = (county: County) => {
    setEditingCounty(county);
    setFormData({ name: county.name, code: county.code, federal_state_id: county.federal_state_id, is_active: county.is_active ?? true });
    setIsDialogOpen(true);
  };

  const getStateName = (stateId: string) => federalStates.find(s => s.id === stateId)?.name || "-";
  const getStateCode = (stateId: string) => federalStates.find(s => s.id === stateId)?.code || "";

  const filteredCounties = filterStateId ? counties.filter(c => c.federal_state_id === filterStateId) : counties;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building className="w-6 h-6" />
              {labels.plural}
            </h1>
            <p className="text-muted-foreground">{filteredCounties.length} {labels.plural}</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />{labels.addNew}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCounty ? `Edit ${labels.singular}` : labels.addNew}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={labels.namePlaceholder} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder={labels.codePlaceholder} required />
                </div>
                <div className="space-y-2">
                  <Label>{labels.parentSingular}</Label>
                  <Select value={formData.federal_state_id} onValueChange={(value) => setFormData({ ...formData, federal_state_id: value })}>
                    <SelectTrigger><SelectValue placeholder={`Select ${labels.parentSingular}`} /></SelectTrigger>
                    <SelectContent>
                      {federalStates.map((state) => (
                        <SelectItem key={state.id} value={state.id}>{state.name} ({state.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <Button type="submit" className="w-full">{editingCounty ? "Save" : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filter */}
        <div className="flex gap-4">
          <Select value={filterStateId || "all"} onValueChange={(value) => setFilterStateId(value === "all" ? "" : value)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={`Filter by ${labels.parentSingular}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {labels.parentPlural}</SelectItem>
              {federalStates.map((state) => (
                <SelectItem key={state.id} value={state.id}>{state.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>{labels.parentSingular}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCounties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No {labels.plural} found.
                    </TableCell>
                  </TableRow>
                ) : filteredCounties.map((county) => (
                  <TableRow key={county.id}>
                    <TableCell className="font-medium">{county.name}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{county.code}</code></TableCell>
                    <TableCell>
                      {getStateName(county.federal_state_id)}{" "}
                      <span className="text-muted-foreground text-xs">({getStateCode(county.federal_state_id)})</span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${county.is_active ? "bg-sage-light text-sage" : "bg-muted text-muted-foreground"}`}>
                        {county.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(county)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(county.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCounties;
