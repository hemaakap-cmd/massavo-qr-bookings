import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, Map } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

// Geographic terminology per country code
const GEO_LABELS: Record<string, { singular: string; plural: string; addNew: string; codePlaceholder: string; namePlaceholder: string; description: string }> = {
  DE: { singular: "Bundesland", plural: "Bundesländer", addNew: "Bundesland hinzufügen", codePlaceholder: "z.B. BY", namePlaceholder: "z.B. Bayern", description: "Deutsche Bundesländer verwalten" },
  EG: { singular: "محافظة", plural: "المحافظات", addNew: "إضافة محافظة", codePlaceholder: "مثال: CAI", namePlaceholder: "مثال: القاهرة", description: "إدارة المحافظات المصرية" },
  SA: { singular: "منطقة", plural: "المناطق", addNew: "إضافة منطقة", codePlaceholder: "مثال: RUH", namePlaceholder: "مثال: الرياض", description: "إدارة المناطق الإدارية" },
};

const DEFAULT_LABELS = { singular: "Region", plural: "Regions", addNew: "Add Region", codePlaceholder: "e.g. BY", namePlaceholder: "e.g. Bavaria", description: "Manage geographic regions" };

interface FederalState {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  country_id: string;
  city_count?: number;
}

const AdminFederalStates = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const activeCountryId = selectedCountry?.id || null;
  const countryCode = selectedCountry?.code || "DE";
  const labels = GEO_LABELS[countryCode] || DEFAULT_LABELS;

  const [states, setStates] = useState<FederalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingState, setEditingState] = useState<FederalState | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", is_active: true });
  const { toast } = useToast();

  const fetchStates = async () => {
    setLoading(true);
    let query = supabase.from("federal_states").select("*").order("name");
    if (activeCountryId) query = query.eq("country_id", activeCountryId);

    const { data: statesData, error } = await query;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Get city counts
    let cityQuery = supabase.from("cities").select("federal_state_id");
    if (activeCountryId) cityQuery = cityQuery.eq("country_id", activeCountryId);
    const { data: cityCounts } = await cityQuery;

    const countMap: Record<string, number> = {};
    cityCounts?.forEach((city) => {
      if (city.federal_state_id) {
        countMap[city.federal_state_id] = (countMap[city.federal_state_id] || 0) + 1;
      }
    });

    setStates((statesData || []).map((s) => ({ ...s, city_count: countMap[s.id] || 0 })));
    setLoading(false);
  };

  useEffect(() => { fetchStates(); }, [activeCountryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stateData = {
      name: formData.name,
      code: formData.code.toUpperCase(),
      is_active: formData.is_active,
      country_id: activeCountryId!,
    };

    if (editingState) {
      const { error } = await supabase.from("federal_states").update(stateData).eq("id", editingState.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓", description: `${labels.singular} updated` });
        setIsDialogOpen(false);
        fetchStates();
      }
    } else {
      const { error } = await supabase.from("federal_states").insert([stateData]);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✓", description: `${labels.singular} created` });
        setIsDialogOpen(false);
        fetchStates();
      }
    }
  };

  const handleEdit = (state: FederalState) => {
    setEditingState(state);
    setFormData({ name: state.name, code: state.code, is_active: state.is_active });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete this ${labels.singular}?`)) return;
    const { error } = await supabase.from("federal_states").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✓", description: `${labels.singular} deleted` });
      fetchStates();
    }
  };

  const resetForm = () => {
    setEditingState(null);
    setFormData({ name: "", code: "", is_active: true });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              {labels.plural}
            </h2>
            <p className="text-muted-foreground">{labels.description}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="sage">
                <Plus className="w-4 h-4 mr-2" />
                {labels.addNew}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingState ? `Edit ${labels.singular}` : labels.addNew}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={labels.namePlaceholder} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder={labels.codePlaceholder} maxLength={4} required />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <Button type="submit" variant="sage" className="w-full">
                  {editingState ? "Update" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-sage" />
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.singular}</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Cities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {states.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No {labels.plural} found. Add your first to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  states.map((state) => (
                    <TableRow key={state.id}>
                      <TableCell className="font-medium">{state.name}</TableCell>
                      <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{state.code}</code></TableCell>
                      <TableCell>{state.city_count || 0}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${state.is_active ? "bg-sage-light text-sage" : "bg-muted text-muted-foreground"}`}>
                          {state.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(state)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(state.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminFederalStates;
