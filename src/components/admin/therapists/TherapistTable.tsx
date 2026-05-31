import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Star, MapPin, ArrowUpDown } from "lucide-react";
import { Therapist, professionLabels, calculateDistance } from "@/types/therapist";
import { TherapistContactActions } from "./TherapistContactActions";

interface Gym {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

interface TherapistTableProps {
  therapists: Therapist[];
  gyms: Gym[];
  onEdit: (therapist: Therapist) => void;
  onDelete: (id: string) => void;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}

export function TherapistTable({
  therapists,
  gyms,
  onEdit,
  onDelete,
  sortField,
  sortDirection,
  onSort,
}: TherapistTableProps) {
  const getDistanceToGym = (therapist: Therapist): string | null => {
    if (!therapist.latitude || !therapist.longitude) return null;
    
    const gym = gyms.find((g) => g.id === therapist.gym_id);
    if (!gym?.latitude || !gym?.longitude) return null;

    const distance = calculateDistance(
      therapist.latitude,
      therapist.longitude,
      gym.latitude,
      gym.longitude
    );
    
    return `${distance.toFixed(1)} km`;
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-sage" : "text-muted-foreground"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="name">Name</SortableHeader>
            <SortableHeader field="profession">Profession</SortableHeader>
            <TableHead>Contact</TableHead>
            <SortableHeader field="city">City</SortableHeader>
            <TableHead>Gym</TableHead>
            <TableHead>Distance</TableHead>
            <SortableHeader field="rating">Rating</SortableHeader>
            <SortableHeader field="is_available">Status</SortableHeader>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {therapists.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No therapists found. Add your first therapist to get started.
              </TableCell>
            </TableRow>
          ) : (
            therapists.map((therapist) => {
              const distance = getDistanceToGym(therapist);
              
              return (
                <TableRow key={therapist.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{therapist.name}</div>
                      {therapist.specialty && (
                        <div className="text-xs text-muted-foreground">{therapist.specialty}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {professionLabels[therapist.profession] || therapist.profession}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TherapistContactActions
                      phone={therapist.phone}
                      email={therapist.email}
                      name={therapist.name}
                    />
                  </TableCell>
                  <TableCell>
                    {therapist.cities?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {therapist.therapist_gyms?.length
                        ? therapist.therapist_gyms.map((tg) => (
                            <Badge key={tg.gym_id} variant={tg.is_primary ? "default" : "outline"} className="mr-1 mb-0.5 text-xs">
                              {tg.gyms?.name || "—"}
                            </Badge>
                          ))
                        : therapist.gyms?.name || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {distance ? (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {distance}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-gold fill-gold" />
                      {therapist.rating}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={therapist.is_available ? "default" : "secondary"}
                      className={therapist.is_available ? "bg-sage-light text-sage" : ""}
                    >
                      {therapist.is_available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(therapist)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(therapist.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
