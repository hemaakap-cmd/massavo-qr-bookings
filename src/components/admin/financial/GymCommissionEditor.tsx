import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Percent } from "lucide-react";

interface Gym {
  id: string;
  name: string;
  commission_percentage: number | null;
  type?: "gym" | "hotel";
}

interface GymCommissionEditorProps {
  gym: Gym | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const GymCommissionEditor = ({ gym, open, onOpenChange, onSaved }: GymCommissionEditorProps) => {
  const [commission, setCommission] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && gym) {
      setCommission(String(gym.commission_percentage ?? 20));
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!gym) return;
    
    const commissionValue = parseFloat(commission);
    if (isNaN(commissionValue) || commissionValue < 0 || commissionValue > 100) {
      toast({
        title: "Invalid Commission",
        description: "Commission must be between 0 and 100 percent.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const table = gym.type === "hotel" ? "hotels" : "gyms";
    const { error } = await supabase
      .from(table)
      .update({ commission_percentage: commissionValue })
      .eq("id", gym.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Commission Updated",
        description: `${gym.name} commission set to ${commissionValue}%`,
      });
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Commission Rate</DialogTitle>
          <DialogDescription>
            Set the commission percentage for {gym?.name}. This will be used for all financial calculations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Label htmlFor="commission">Commission Percentage</Label>
          <div className="flex items-center gap-2 mt-2">
            <Input
              id="commission"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              className="w-32"
            />
            <Percent className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            The gym receives this percentage of each booking's total price.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Commission
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GymCommissionEditor;
