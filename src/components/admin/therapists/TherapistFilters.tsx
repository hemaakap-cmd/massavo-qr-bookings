import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Filter } from "lucide-react";
import { ProfessionType, professionLabels } from "@/types/therapist";

interface City {
  id: string;
  name: string;
}

interface TherapistFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  cityFilter: string;
  onCityFilterChange: (value: string) => void;
  professionFilter: string;
  onProfessionFilterChange: (value: string) => void;
  availabilityFilter: string;
  onAvailabilityFilterChange: (value: string) => void;
  cities: City[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export function TherapistFilters({
  searchQuery,
  onSearchChange,
  cityFilter,
  onCityFilterChange,
  professionFilter,
  onProfessionFilterChange,
  availabilityFilter,
  onAvailabilityFilterChange,
  cities,
  onClearFilters,
  hasActiveFilters,
}: TherapistFiltersProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Filter className="w-4 h-4" />
        Search & Filter
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email, city..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* City Filter */}
        <Select value={cityFilter} onValueChange={onCityFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city.id} value={city.id}>
                {city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Profession Filter */}
        <Select value={professionFilter} onValueChange={onProfessionFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Professions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Professions</SelectItem>
            {Object.entries(professionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Availability Filter */}
        <Select value={availabilityFilter} onValueChange={onAvailabilityFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
