import { usePublicCountry } from "@/contexts/CountryContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown } from "lucide-react";

const FLAG_MAP: Record<string, string> = {
  DE: "🇩🇪",
  EG: "🇪🇬",
  SA: "🇸🇦",
};

export function CountrySwitcherPublic() {
  const { countries, selectedCountry, selectCountry } = usePublicCountry();
  if (countries.length <= 1) return null;

  const getCountryName = (country: typeof countries[0]) => country.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2">
          <MapPin className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {countries.map((country) => (
          <DropdownMenuItem
            key={country.id}
            onClick={() => selectCountry(country.id)}
            className={`gap-2 cursor-pointer ${
              country.id === selectedCountry?.id ? "bg-sage-light font-medium" : ""
            }`}
          >
            <span className="text-base">{FLAG_MAP[country.code] || "🌍"}</span>
            <span className="text-sm">{getCountryName(country)}</span>
            <span className="text-xs text-muted-foreground ml-auto">{country.currency_symbol}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
