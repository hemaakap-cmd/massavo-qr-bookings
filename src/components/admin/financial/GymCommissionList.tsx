import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Building2, Percent } from "lucide-react";
import GymCommissionEditor from "./GymCommissionEditor";
import type { GymCommission } from "@/types/financial";

interface Gym {
  id: string;
  name: string;
  commission_percentage: number | null;
  type?: "gym" | "hotel";
}

interface GymCommissionListProps {
  gyms: Gym[];
  commissions: GymCommission[];
  onCommissionUpdated: () => void;
}

const GymCommissionList = ({ gyms, commissions, onCommissionUpdated }: GymCommissionListProps) => {
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getCommissionData = (gymId: string): GymCommission | undefined => {
    return commissions.find((c) => c.id === gymId);
  };

  const handleEdit = (gym: Gym) => {
    setEditingGym(gym);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gym</TableHead>
              <TableHead className="text-center">Commission Rate</TableHead>
              <TableHead className="text-right">Total Revenue</TableHead>
              <TableHead className="text-right">Commission Owed</TableHead>
              <TableHead className="text-center">Sessions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gyms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No gyms found.
                </TableCell>
              </TableRow>
            ) : (
              gyms.map((gym) => {
                const data = getCommissionData(gym.id);
                return (
                  <TableRow key={gym.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{gym.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono">
                        <Percent className="w-3 h-3 mr-1" />
                        {gym.commission_percentage ?? 20}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      €{(data?.total_revenue ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-orange-600">
                      €{(data?.total_commission ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {data?.booking_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(gym)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Rate
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <GymCommissionEditor
        gym={editingGym}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={onCommissionUpdated}
      />
    </>
  );
};

export default GymCommissionList;
