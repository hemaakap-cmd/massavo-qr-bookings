import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n";

export interface PublicCountry {
  id: string;
  name: string;
  name_ar: string | null;
  code: string;
  currency_code: string;
  currency_symbol: string;
  timezone: string;
  default_language: string;
  is_active: boolean;
}

interface CountryContextValue {
  countries: PublicCountry[];
  selectedCountry: PublicCountry | null;
  selectCountry: (id: string) => void;
  loading: boolean;
  formatPrice: (amount: number) => string;
}

const CountryContext = createContext<CountryContextValue | null>(null);

const STORAGE_KEY = "massavo_public_country";

// Map browser timezone to country code
function detectCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith("Africa/Cairo") || tz.startsWith("Egypt")) return "EG";
    if (tz.startsWith("Asia/Riyadh") || tz.startsWith("Asia/Jeddah")) return "SA";
    // Default to Germany for European timezones
    return "DE";
  } catch {
    return "DE";
  }
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const [countries, setCountries] = useState<PublicCountry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("id, name, name_ar, code, currency_code, currency_symbol, timezone, default_language, is_active")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setCountries(data as PublicCountry[]);

        const saved = localStorage.getItem(STORAGE_KEY);
        const validSaved = saved && data.some((c: any) => c.id === saved);

        if (validSaved) {
          setSelectedId(saved);
        } else {
          // Auto-detect from timezone
          const detectedCode = detectCountryFromTimezone();
          const match = data.find((c: any) => c.code === detectedCode);
          if (match) {
            setSelectedId((match as any).id);
            localStorage.setItem(STORAGE_KEY, (match as any).id);
          } else if (data.length > 0) {
            setSelectedId((data[0] as any).id);
            localStorage.setItem(STORAGE_KEY, (data[0] as any).id);
          }
        }
      }
      setLoading(false);
    };
    fetchCountries();
  }, []);

  const selectedCountry = countries.find((c) => c.id === selectedId) || null;

  const selectCountry = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    // Language is independent — don't change it when switching country
  }, []);

  const formatPrice = useCallback(
    (amount: number) => {
      if (!selectedCountry) return `€${amount.toFixed(2)}`;
      return `${selectedCountry.currency_symbol}${amount.toFixed(2)}`;
    },
    [selectedCountry]
  );

  return (
    <CountryContext.Provider value={{ countries, selectedCountry, selectCountry, loading, formatPrice }}>
      {children}
    </CountryContext.Provider>
  );
}

export function usePublicCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) throw new Error("usePublicCountry must be used within CountryProvider");
  return ctx;
}
