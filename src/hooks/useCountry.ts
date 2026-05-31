import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Country {
  id: string;
  name: string;
  name_ar: string | null;
  code: string;
  currency_code: string;
  currency_symbol: string;
  timezone: string;
  default_language: string;
  is_active: boolean;
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  bank_account_holder?: string | null;
  tax_rate: number;
  tax_label: string;
  tax_id_label: string;
  tax_id_value?: string | null;
  invoice_footer_note?: string | null;
  stripe_secret_key_name?: string;
  stripe_publishable_key?: string | null;
}

interface CountryContextValue {
  countries: Country[];
  selectedCountry: Country | null;
  setSelectedCountryId: (id: string) => void;
  loading: boolean;
  formatCurrency: (amount: number) => string;
}

const STORAGE_KEY = "massavo_selected_country";
const COUNTRY_CHANGE_EVENT = "massavo-country-changed";

export function useCountryData(userCountryId?: string | null): CountryContextValue {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase
        .from("countries")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        // Try to merge sensitive financial fields from country_financials (admins only via RLS)
        const { data: fin } = await supabase
          .from("country_financials")
          .select("country_id, bank_name, bank_iban, bank_bic, bank_account_holder, tax_id_value, invoice_footer_note, stripe_publishable_key, stripe_secret_key_name");
        const finMap = new Map<string, any>((fin || []).map((f: any) => [f.country_id, f]));
        const merged = (data as any[]).map((c) => ({ ...c, ...(finMap.get(c.id) || {}) }));
        setCountries(merged as unknown as Country[]);

        // Auto-select: saved preference → user's country → first country
        const saved = localStorage.getItem(STORAGE_KEY);
        const validSaved = saved && data.some((c: any) => c.id === saved);
        if (validSaved) {
          setSelectedId(saved);
        } else if (userCountryId && data.some((c: any) => c.id === userCountryId)) {
          setSelectedId(userCountryId);
        } else if (data.length > 0) {
          setSelectedId((data[0] as any).id);
        }
      }
      setLoading(false);
    };
    fetch();
  }, [userCountryId]);

  const setSelectedCountryId = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent(COUNTRY_CHANGE_EVENT, { detail: { id } }));
  }, []);

  useEffect(() => {
    const syncSelectedCountry = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedId(saved);
    };

    const handleCustomCountryChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id) setSelectedId(customEvent.detail.id);
    };

    window.addEventListener("storage", syncSelectedCountry);
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCustomCountryChange as EventListener);

    return () => {
      window.removeEventListener("storage", syncSelectedCountry);
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCustomCountryChange as EventListener);
    };
  }, []);

  const selectedCountry = countries.find((c) => c.id === selectedId) || null;

  const formatCurrency = useCallback(
    (amount: number) => {
      if (!selectedCountry) return `€${amount.toFixed(2)}`;
      return `${selectedCountry.currency_symbol} ${amount.toFixed(2)}`;
    },
    [selectedCountry]
  );

  return { countries, selectedCountry, setSelectedCountryId, loading, formatCurrency };
}
