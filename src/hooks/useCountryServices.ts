import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePublicCountry } from "@/contexts/CountryContext";

export interface CountryService {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  duration_minutes: number;
  price: number;
  icon: string | null;
}

export function useCountryServices() {
  const { selectedCountry } = usePublicCountry();
  const [services, setServices] = useState<CountryService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      if (!selectedCountry) {
        setServices([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("services")
        .select("id, name, name_ar, description, description_ar, duration_minutes, price, icon")
        .eq("is_active", true)
        .eq("country_id", selectedCountry.id)
        .order("price");

      if (!error && data) {
        setServices(data as CountryService[]);
      }
      setLoading(false);
    };

    fetch();
  }, [selectedCountry?.id]);

  return { services, loading, country: selectedCountry };
}
