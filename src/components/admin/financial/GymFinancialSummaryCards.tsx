import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Euro, Percent, Calendar, Edit } from "lucide-react";
import GymCommissionEditor from "./GymCommissionEditor";

interface Gym {
  id: string;
  name: string;
  commission_percentage: number | null;
}

interface GymFinancialSummaryProps {
  gymId: string;
  gymName: string;
  commissionPercentage: number;
  totalCommission: number;
  sessionCount: number;
  onCommissionUpdated?: () => void;
}

/**
 * Gym-specific financial summary cards
 * Shows ONLY commission-related data - no company revenue or profits
 * Includes inline edit button for commission rate
 */
const GymFinancialSummaryCards = ({ 
  gymId,
  gymName, 
  commissionPercentage, 
  totalCommission, 
  sessionCount,
  onCommissionUpdated
}: GymFinancialSummaryProps) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const gymForEditor: Gym = {
    id: gymId,
    name: gymName,
    commission_percentage: commissionPercentage
  };

  const handleSaved = () => {
    if (onCommissionUpdated) {
      onCommissionUpdated();
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Rate</p>
                <p className="text-2xl font-bold text-foreground">
                  {commissionPercentage}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">{gymName}</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Percent className="h-6 w-6 text-primary" />
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setEditDialogOpen(true)}
                  className="text-xs h-7 px-2"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Commission Earned</p>
                <p className="text-2xl font-bold text-orange-600">
                  €{totalCommission.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Total owed to gym</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Euro className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Eligible Sessions</p>
                <p className="text-2xl font-bold text-foreground">{sessionCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Completed massages</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <GymCommissionEditor
        gym={gymForEditor}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={handleSaved}
      />
    </>
  );
};

export default GymFinancialSummaryCards;
