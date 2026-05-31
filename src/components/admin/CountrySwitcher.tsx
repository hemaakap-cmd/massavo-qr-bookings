import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Country } from "@/hooks/useCountry";

const FLAG_MAP: Record<string, string> = {
  DE: "🇩🇪",
  EG: "🇪🇬",
  SA: "🇸🇦",
};

interface CountrySwitcherProps {
  countries: Country[];
  selectedCountryId: string | null;
  onSelect: (id: string) => void;
  collapsed?: boolean;
}

export function CountrySwitcher({
  countries,
  selectedCountryId,
  onSelect,
  collapsed,
}: CountrySwitcherProps) {
  const selected = countries.find((c) => c.id === selectedCountryId);

  if (collapsed) {
    return (
      <button
        onClick={() => {
          // Cycle through countries
          const idx = countries.findIndex((c) => c.id === selectedCountryId);
          const next = countries[(idx + 1) % countries.length];
          if (next) onSelect(next.id);
        }}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-accent text-sidebar-primary hover:bg-sidebar-accent/80 transition-colors mx-auto"
        title={selected?.name || "Switch country"}
      >
        <span className="text-base">{FLAG_MAP[selected?.code || "DE"] || "🌍"}</span>
      </button>
    );
  }

  return (
    <div className="px-3">
      <div className="flex items-center gap-2 text-[10px] text-admin-text-secondary font-semibold uppercase tracking-widest mb-1.5 px-1">
        <Globe className="w-3 h-3" />
        Country
      </div>
      <Select value={selectedCountryId || ""} onValueChange={onSelect}>
        <SelectTrigger className="h-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-sm">
          <SelectValue placeholder="Select country">
            {selected && (
              <span className="flex items-center gap-2">
                <span>{FLAG_MAP[selected.code] || "🌍"}</span>
                <span>{selected.name}</span>
                <span className="text-[10px] text-muted-foreground">({selected.currency_code})</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countries.map((country) => (
            <SelectItem key={country.id} value={country.id}>
              <span className="flex items-center gap-2">
                <span>{FLAG_MAP[country.code] || "🌍"}</span>
                <span>{country.name}</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  {country.currency_code}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
