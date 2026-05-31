import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Building2 } from "lucide-react";

interface Gym {
  id: string;
  name: string;
}

interface FinancialFiltersProps {
  gyms: Gym[];
  gymFilter: string;
  onGymFilterChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
}

const FinancialFilters = ({
  gyms,
  gymFilter,
  onGymFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: FinancialFiltersProps) => {
  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Gym Filter */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Gym</Label>
        <Select value={gymFilter} onValueChange={onGymFilterChange}>
          <SelectTrigger className="w-56">
            <Building2 className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select gym" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Gyms</SelectItem>
            {gyms.map((gym) => (
              <SelectItem key={gym.id} value={gym.id}>
                {gym.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">From Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="pl-10 w-44"
          />
        </div>
      </div>

      {/* Date To */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">To Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="pl-10 w-44"
          />
        </div>
      </div>
    </div>
  );
};

export default FinancialFilters;
