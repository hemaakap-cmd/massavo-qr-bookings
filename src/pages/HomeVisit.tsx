import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Home, ArrowRight, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ClientInfoForm, { ClientInfo, calculateAge, inferGender } from "@/components/booking/ClientInfoForm";
import { supabase } from "@/integrations/supabase/client";
import { usePublicCountry } from "@/contexts/CountryContext";
import { usePayment } from "@/hooks/usePayment";
import { useHomeAvailableDates, useHomeBookedSlots } from "@/hooks/useHomeAvailability";

interface HomeCity {
  id: string;
  name: string;
  country_id: string | null;
}

interface HomeService {
  id: string;
  name: string;
  name_ar?: string | null;
  description?: string | null;
  price: number;
  duration_minutes: number;
}

// Untyped client for columns/flags added by the home-visit migration that are
// not yet in the generated types (services.home_visit_enabled).
const sbAny = supabase as unknown as {
  from: (t: string) => any;
};

// Standard home-visit slot grid; individual slots are disabled when the whole
// city therapist pool is busy (get_home_booked_slots).
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

const HomeVisit = () => {
  const { t, i18n } = useTranslation();
  const { selectedCountry, formatPrice } = usePublicCountry();
  const { initiatePayment, isLoading: isPaying } = usePayment();

  const [cities, setCities] = useState<HomeCity[]>([]);
  const [services, setServices] = useState<HomeService[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    firstName: "", lastName: "", email: "", dateOfBirth: "", salutation: "",
    phone: "", street: "", houseNumber: "", postalCode: "", city: "",
    healthConfirmed: false, isPregnant: null, notes: "",
  });

  const { data: availableDates = [] } = useHomeAvailableDates(cityId);
  const { data: bookedSlots = [] } = useHomeBookedSlots(cityId, selectedDate);

  // Load cities for the active country.
  useEffect(() => {
    const run = async () => {
      if (!selectedCountry?.id) return;
      const { data } = await supabase
        .from("cities")
        .select("id, name, country_id")
        .eq("is_active", true)
        .eq("country_id", selectedCountry.id)
        .order("name");
      setCities((data as HomeCity[]) || []);
    };
    run();
  }, [selectedCountry?.id]);

  // Load home-visit-enabled services. Falls back to empty if the column/flag is
  // not deployed yet (query errors are swallowed to keep the page usable).
  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await sbAny
          .from("services")
          .select("id, name, name_ar, description, price, duration_minutes")
          .eq("is_active", true)
          .eq("home_visit_enabled", true)
          .order("price");
        if (!error && data) setServices(data as HomeService[]);
        else setServices([]);
      } catch {
        setServices([]);
      }
    };
    run();
  }, []);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId],
  );

  const isAr = i18n.language === "ar";
  const serviceLabel = (s: HomeService) => (isAr && s.name_ar ? s.name_ar : s.name);

  const canBook =
    !!cityId && !!serviceId && !!selectedDate && !!selectedTime &&
    !!clientInfo.firstName && !!clientInfo.email && !!clientInfo.street &&
    !!clientInfo.postalCode && clientInfo.healthConfirmed;

  const handleBook = useCallback(async () => {
    if (!canBook || !selectedService) return;
    const fullName = `${clientInfo.firstName} ${clientInfo.lastName}`.trim();
    const inferredGender = inferGender(clientInfo.salutation);
    try {
      await initiatePayment({
        serviceId,
        venueType: "home",
        bookingDate: selectedDate,
        timeSlot: selectedTime,
        homeCityId: cityId,
        homeCountryId: selectedCountry?.id,
        homeStreet: clientInfo.street,
        homeHouseNo: clientInfo.houseNumber,
        homePostalCode: clientInfo.postalCode,
        homeAddressNotes: clientInfo.notes?.trim() || undefined,
        customerEmail: clientInfo.email,
        clientName: fullName,
        clientAge: calculateAge(clientInfo.dateOfBirth),
        clientPhone: clientInfo.phone,
        clientAddress: `${clientInfo.street} ${clientInfo.houseNumber}, ${clientInfo.postalCode} ${clientInfo.city}`.trim(),
        healthConfirmed: clientInfo.healthConfirmed,
        dateOfBirth: clientInfo.dateOfBirth,
        salutation: clientInfo.salutation,
        gender: inferredGender,
        pregnancyStatus: inferredGender === "female" ? "not_pregnant" : null,
      });
    } catch (e) {
      console.error("Home visit payment error:", e);
      toast.error(t("homeVisit.paymentError", "Zahlung konnte nicht gestartet werden."));
    }
  }, [canBook, selectedService, clientInfo, initiatePayment, serviceId, selectedDate, selectedTime, cityId, selectedCountry?.id, t]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={t("homeVisit.seoTitle", "Hausbesuch buchen — Massavo")}
        description={t("homeVisit.seoDescription", "Buche eine Massage bei dir zu Hause. Ein Therapeut kommt zu deiner Adresse.")}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 md:py-16 max-w-3xl">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-xl bg-sage-light flex items-center justify-center text-primary mx-auto mb-4">
            <Home className="w-7 h-7" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            {t("homeVisit.title", "Massage als Hausbesuch")}
          </h1>
          <p className="text-muted-foreground">
            {t("homeVisit.subtitle", "Wähle Stadt, Behandlung und Zeit — der Therapeut kommt zu dir.")}
          </p>
        </div>

        <div className="space-y-6">
          {/* City */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <label className="flex items-center gap-2 text-foreground font-medium mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              {t("homeVisit.selectCity", "Stadt")}
            </label>
            <Select value={cityId} onValueChange={(v) => { setCityId(v); setSelectedDate(""); setSelectedTime(""); }}>
              <SelectTrigger aria-label={t("homeVisit.selectCity", "Stadt")}>
                <SelectValue placeholder={t("homeVisit.selectCityPlaceholder", "Stadt auswählen")} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Service */}
          {cityId && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <label className="block text-foreground font-medium mb-3">
                {t("homeVisit.selectService", "Behandlung")}
              </label>
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("homeVisit.noServices", "Zurzeit sind keine Behandlungen als Hausbesuch verfügbar.")}
                </p>
              ) : (
                <div className="grid gap-3">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setServiceId(s.id)}
                      className={`text-left rounded-xl border p-4 transition-all ${serviceId === s.id ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-foreground">{serviceLabel(s)}</span>
                        <span className="text-primary font-semibold">{formatPrice(s.price)}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{s.duration_minutes} min</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Date + time */}
          {serviceId && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <label className="block text-foreground font-medium mb-3">
                {t("homeVisit.selectDate", "Datum")}
              </label>
              {availableDates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("homeVisit.noDates", "Für diese Stadt sind aktuell keine Termine verfügbar.")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-5">
                  {availableDates.slice(0, 21).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setSelectedDate(d); setSelectedTime(""); }}
                      className={`px-3 py-2 rounded-lg border text-sm ${selectedDate === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {selectedDate && (
                <>
                  <label className="block text-foreground font-medium mb-3">
                    {t("homeVisit.selectTime", "Uhrzeit")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SLOTS.map((slot) => {
                      const booked = bookedSlots.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={booked}
                          onClick={() => setSelectedTime(slot)}
                          className={`px-3 py-2 rounded-lg border text-sm ${
                            booked
                              ? "border-border opacity-40 cursor-not-allowed line-through"
                              : selectedTime === slot
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Client + address (destination) */}
          {selectedTime && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-display font-semibold text-foreground mb-1">
                {t("homeVisit.yourDetails", "Deine Angaben & Adresse")}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {t("homeVisit.addressHint", "Die angegebene Adresse ist der Ort des Hausbesuchs.")}
              </p>
              <ClientInfoForm clientInfo={clientInfo} onChange={setClientInfo} />
            </section>
          )}

          {/* Confirm */}
          {selectedTime && (
            <div className="flex justify-end">
              <Button
                size="lg"
                variant="hero"
                disabled={!canBook || isPaying}
                onClick={handleBook}
                className="group"
              >
                {isPaying ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{t("homeVisit.proceedToPayment", "Weiter zur Zahlung")}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HomeVisit;
