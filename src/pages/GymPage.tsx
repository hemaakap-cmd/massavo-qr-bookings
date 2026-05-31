import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { grantQRAccess } from "@/lib/qrAccess";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Helmet } from "react-helmet-async";
import ServiceSelector from "@/components/booking/ServiceSelector";
import { ScheduleAwareTimeSlotPicker } from "@/components/booking/ScheduleAwareTimeSlotPicker";
import ClientInfoForm, { ClientInfo, calculateAge, inferGender } from "@/components/booking/ClientInfoForm";
import BotProtection from "@/components/booking/BotProtection";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, MapPin, Star, Clock, Check, Loader2, Info, UserRound, ChevronDown, ArrowRight, HeartPulse, ScrollText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import GymQRCode from "@/components/gym/GymQRCode";
import { usePayment } from "@/hooks/usePayment";
import { useBotProtection } from "@/hooks/useBotProtection";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { BodyDiagram, SelectedArea, BodyArea } from "@/components/body-diagram/BodyDiagram";
import { useDisallowedAreaCodes } from "@/hooks/useBodyAreaRestrictions";
import { IntensityPricingBox } from "@/components/booking/IntensityPricingBox";
import { DeepTissueUpgradeModal } from "@/components/booking/DeepTissueUpgradeModal";
import {
  calculateIntensitySurcharge,
  shouldOfferDeepTissue,
  getFinalSurcharge,
  DEEP_TISSUE_UPGRADE_PRICE,
} from "@/utils/intensityPricing";
interface Gym {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  open_hours: string;
  city_id: string;
  city?: { name: string };
}

interface Service {
  id: string;
  name: string;
  name_ar?: string;
  description: string;
  description_ar?: string;
  duration_minutes: number;
  price: number;
  icon: string;
}

// Static payment links removed - all payments now use dynamic checkout via create-payment edge function

const GymPage = () => {
  const { gymId } = useParams();
  const { t, i18n } = useTranslation();
  useEffect(() => {
    grantQRAccess("gym");
  }, []);
  const [gym, setGym] = useState<Gym | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    salutation: "",
    phone: "",
    street: "",
    houseNumber: "",
    postalCode: "",
    city: "",
    healthConfirmed: false,
    isPregnant: null,
    notes: "",
  });
  const [selectedBodyAreas, setSelectedBodyAreas] = useState<SelectedArea[]>([]);
  const [communicationPreference, setCommunicationPreference] = useState<string>("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [deepTissueUpgradeActive, setDeepTissueUpgradeActive] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalDismissed, setUpgradeModalDismissed] = useState(false);
  const { initiatePayment, isLoading: isPaymentLoading } = usePayment();
  const disallowedAreas = useDisallowedAreaCodes();
  const { isVerified: isBotVerified, token: botToken, formLoadTime, handleVerification } = useBotProtection();
  
  // Prevent double-clicks and track payment state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const paymentClickRef = useRef<number>(0);
  const notesRef = useRef<HTMLDivElement>(null);

  // Intensity pricing calculations
  const intensityPricing = useMemo(
    () => calculateIntensitySurcharge(selectedBodyAreas),
    [selectedBodyAreas]
  );
  const finalSurcharge = useMemo(
    () => getFinalSurcharge(selectedBodyAreas, deepTissueUpgradeActive),
    [selectedBodyAreas, deepTissueUpgradeActive]
  );

  useEffect(() => {
    const fetchData = async () => {
      // Fetch gym data - use public view that excludes sensitive business data (phone, commission, qr_code_id)
      const { data: gymData } = await supabase
        .from("gyms_public")
        .select("id, name, address, city_id, rating, review_count, image_url, open_hours, is_active, city:cities(name)")
        .eq("id", gymId)
        .single();

      if (gymData) {
        setGym(gymData as Gym);

        // Fetch gym_services assignments to get only assigned services
        const { data: gymServiceData } = await supabase
          .from("gym_services")
          .select("service_id, custom_price, promo_price, promo_starts_at, promo_ends_at, promo_label, services(id, name, name_ar, description, description_ar, duration_minutes, price, icon, is_active)")
          .eq("gym_id", gymId)
          .eq("is_active", true);

        if (gymServiceData && gymServiceData.length > 0) {
          // Use assigned services with optional custom pricing
          const nowMs = Date.now();
          const assignedServices = gymServiceData
            .filter((gs: any) => gs.services && gs.services.is_active)
            .map((gs: any) => {
              const promoActive =
                gs.promo_price != null &&
                (!gs.promo_starts_at || new Date(gs.promo_starts_at).getTime() <= nowMs) &&
                (!gs.promo_ends_at || new Date(gs.promo_ends_at).getTime() >= nowMs);
              const effective = promoActive ? Number(gs.promo_price) : (gs.custom_price ?? gs.services.price);
              const original = gs.custom_price ?? gs.services.price;
              return {
                ...gs.services,
                price: effective,
                original_price: promoActive ? original : null,
                promo_label: promoActive ? gs.promo_label : null,
              };
            });
          setServices(assignedServices);
        } else {
          // Fallback: if no gym_services assigned, show country services only
          const { data: gymFull } = await supabase
            .from("gyms")
            .select("country_id")
            .eq("id", gymId)
            .single();

          if (gymFull?.country_id) {
            const { data: servicesData } = await supabase
              .from("services")
              .select("*")
              .eq("is_active", true)
              .eq("country_id", gymFull.country_id)
              .order("price");
            if (servicesData) setServices(servicesData);
          }
        }
      }

      setLoading(false);
    };

    if (gymId) {
      fetchData();
    }
  }, [gymId]);

  // Validation helpers
  const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPostalCode = (code: string): boolean => /^\d{5}$/.test(code);
  const isValidPhone = (phone: string): boolean => phone.replace(/\D/g, '').length >= 6;
  const isValidDateOfBirth = (dob: string): boolean => {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dob)) return false;
    const [day, month, year] = dob.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
    const age = calculateAge(dob);
    return age >= 16 && age <= 120;
  };

  // Check if pregnancy blocks the booking
  const isPregnancyBlocked = clientInfo.salutation === "Frau" && clientInfo.isPregnant === true;
  // For females, pregnancy question must be answered
  const isPregnancyAnswered = clientInfo.salutation !== "Frau" || clientInfo.isPregnant !== null;

  const isClientInfoComplete = 
    clientInfo.salutation && 
    clientInfo.firstName.trim() && 
    clientInfo.lastName.trim() && 
    clientInfo.email.trim() && 
    isValidEmail(clientInfo.email) &&
    clientInfo.dateOfBirth && 
    isValidDateOfBirth(clientInfo.dateOfBirth) &&
    clientInfo.phone.trim() && 
    isValidPhone(clientInfo.phone) &&
    clientInfo.street.trim() && 
    clientInfo.houseNumber.trim() && 
    clientInfo.postalCode && 
    isValidPostalCode(clientInfo.postalCode) &&
    clientInfo.city.trim() && 
    clientInfo.healthConfirmed &&
    isPregnancyAnswered &&
    !isPregnancyBlocked;

  const canProceed = 
    step === 1 ? selectedService : 
    step === 2 ? (selectedDate && selectedTime) : 
    (isClientInfoComplete && isBotVerified && communicationPreference && policyAccepted);

  const handleNext = useCallback(() => {
    if (isNavigating) return; // Prevent double-click
    setIsNavigating(true);
    if (step < 3) setStep(step + 1);
    window.scrollTo(0, 0);
    setTimeout(() => setIsNavigating(false), 300);
  }, [step, isNavigating]);

  const handleBack = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (step > 1) setStep(step - 1);
    window.scrollTo(0, 0);
    setTimeout(() => setIsNavigating(false), 300);
  }, [step, isNavigating]);

  // Body area handlers
  const handleToggleBodyArea = useCallback((area: BodyArea) => {
    // Prevent selecting disallowed areas
    if (disallowedAreas.has(area.code)) return;
    setSelectedBodyAreas(prev => {
      const exists = prev.find(a => a.code === area.code);
      if (exists) return prev.filter(a => a.code !== area.code);
      return [...prev, { code: area.code, label: area.label, side: area.side, painIntensity: 5 }];
    });
  }, [disallowedAreas]);

  const handleIntensityChange = useCallback((code: string, intensity: number) => {
    setSelectedBodyAreas(prev => {
      const updated = prev.map(a => a.code === code ? { ...a, painIntensity: intensity } : a);
      // Check if Deep Tissue upgrade should be offered
      if (!upgradeModalDismissed && !deepTissueUpgradeActive && shouldOfferDeepTissue(updated)) {
        setShowUpgradeModal(true);
      }
      return updated;
    });
  }, [upgradeModalDismissed, deepTissueUpgradeActive]);

  const handleToggleFocus = useCallback((code: string) => {
    setSelectedBodyAreas(prev => prev.map(a => a.code === code ? { ...a, isFocus: !a.isFocus } : a));
  }, []);

  // Payment handler using dynamic Stripe Checkout via create-payment edge function
  const handlePayment = useCallback(async () => {
    if (!selectedService || !selectedDate || !selectedTime || !gym || !canProceed) return;

    // Prevent double-clicks
    const now = Date.now();
    if (now - paymentClickRef.current < 2000) {
      return;
    }
    paymentClickRef.current = now;
    setIsProcessingPayment(true);

    // Persist body areas + upgrade status to localStorage so PaymentSuccess can save them
    if (selectedBodyAreas.length > 0) {
      localStorage.setItem("massavo_body_areas", JSON.stringify(selectedBodyAreas));
      localStorage.setItem("massavo_intensity_surcharge", String(finalSurcharge));
      localStorage.setItem("massavo_deep_tissue_upgrade", String(deepTissueUpgradeActive));
    } else {
      localStorage.removeItem("massavo_body_areas");
      localStorage.removeItem("massavo_intensity_surcharge");
      localStorage.removeItem("massavo_deep_tissue_upgrade");
    }

    // Persist communication preference
    if (communicationPreference) {
      localStorage.setItem("massavo_comm_pref", communicationPreference);
    }

    try {
      const timeSlot = selectedTime;
      const fullAddress = `${clientInfo.street} ${clientInfo.houseNumber}, ${clientInfo.postalCode} ${clientInfo.city}`;
      const fullName = `${clientInfo.firstName} ${clientInfo.lastName}`.trim();
      const calculatedAge = calculateAge(clientInfo.dateOfBirth);
      const inferredGender = inferGender(clientInfo.salutation);

      const pregnancyStatus = inferredGender === "female" ? "not_pregnant" : null;

      await initiatePayment({
        serviceId: selectedService,
        therapistName: undefined,
        timeSlot: timeSlot,
        bookingDate: selectedDate,
        gymName: gym.name,
        gymId: gym.id,
        customerEmail: clientInfo.email,
        clientName: fullName,
        clientAge: calculatedAge,
        clientPhone: clientInfo.phone,
        clientAddress: fullAddress,
        healthConfirmed: clientInfo.healthConfirmed,
        dateOfBirth: clientInfo.dateOfBirth,
        salutation: clientInfo.salutation,
        gender: inferredGender,
        pregnancyStatus,
        notes: clientInfo.notes?.trim() || undefined,
        communicationPreference: communicationPreference || undefined,
        selectedBodyAreas: selectedBodyAreas.map(a => ({ code: a.code, label: a.label, painIntensity: a.painIntensity })),
        deepTissueUpgradeActive,
      });
    } catch (error) {
      console.error("Payment error:", error);
      toast.error(t("gymPage.paymentError"));
    } finally {
      setIsProcessingPayment(false);
    }
  }, [selectedService, selectedDate, selectedTime, gym, canProceed, clientInfo, initiatePayment, finalSurcharge, deepTissueUpgradeActive]);

  const getSelectedServicePrice = () => {
    const service = services.find((s) => s.id === selectedService);
    return service?.price || 0;
  };

  const isAr = i18n.language === "ar";
  const getServiceName = (s: Service) => isAr && s.name_ar ? s.name_ar : s.name;
  const getServiceDesc = (s: Service) => isAr && s.description_ar ? s.description_ar : (s.description || "");

  const formattedServices = services.map((s) => ({
    id: s.id,
    name: getServiceName(s),
    description: getServiceDesc(s),
    duration: `${s.duration_minutes} min`,
    price: s.price,
    icon: (s.icon || "relaxation") as "sports" | "recovery" | "relaxation",
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground mb-4">
              {t("gymPage.gymNotFound")}
            </h1>
            <Button variant="sage" asChild>
              <Link to="/cities">{t("gymPage.backToCities")}</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      {gym && (
        <>
          <SEO
            title={`${gym.name} – Massage buchen | MASSAVO`}
            description={`Buche Sport-, Klassische und Wellness-Massagen direkt im ${gym.name}${gym.city?.name ? ` in ${gym.city.name}` : ""}. Termine in Sekunden per QR-Code.`}
            path={`/gym/${gym.id}`}
            keywords={`massage ${gym.name}, fitnessstudio massage${gym.city?.name ? `, massage ${gym.city.name}` : ""}`}
          />
          <Helmet>
            <script type="application/ld+json">{JSON.stringify({
              "@context": "https://schema.org",
              "@type": "HealthClub",
              name: gym.name,
              address: {
                "@type": "PostalAddress",
                streetAddress: gym.address,
                addressLocality: gym.city?.name,
                addressCountry: "DE",
              },
              openingHours: gym.open_hours || undefined,
              aggregateRating: gym.rating ? {
                "@type": "AggregateRating",
                ratingValue: gym.rating,
                reviewCount: gym.review_count || 1,
              } : undefined,
              url: `https://massavo.com/gym/${gym.id}`,
            })}</script>
          </Helmet>
        </>
      )}
      <Header />

      <main className="pt-20">
        {/* Hero Banner */}
        <section className="relative h-48 md:h-64 bg-gradient-to-r from-sage to-sage-dark">
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-charcoal/20 to-transparent" />
          

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="container mx-auto">
              <Button variant="ghost" size="sm" asChild className="mb-4 text-cream hover:bg-cream/10">
                <Link to={`/city/${gym.city_id}`}>
                  <ChevronLeft className="w-4 h-4" />
                  {t("gymPage.back")}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Gym Info */}
        <section className="bg-card border-b border-border">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
                  {gym.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {gym.address}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-gold fill-gold" />
                    <span className="font-medium text-foreground">{gym.rating}</span>
                    <span>({gym.review_count} {t("gymPage.reviews")})</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {gym.open_hours || "Sa-So: 10:00-18:00"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Booking Flow - 2 Steps Only */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                {/* Progress Steps - 3 steps */}
                <div className="flex items-center gap-2 md:gap-4 mb-8 overflow-x-auto pb-2">
                  {[
                    { num: 1, label: t("gymPage.stepService") },
                    { num: 2, label: t("gymPage.stepTime") },
                    { num: 3, label: t("gymPage.stepData") },
                  ].map((s, index) => (
                    <div key={s.num} className="flex items-center flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          step > s.num
                            ? "bg-sage text-cream"
                            : step === s.num
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                      </div>
                      <span
                        className={`ml-2 text-sm font-medium ${
                          step >= s.num ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </span>
                      {index < 2 && (
                        <div className={`w-8 md:w-12 h-0.5 mx-2 md:mx-4 ${step > s.num ? "bg-sage" : "bg-border"}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Step Content */}
                <div className="bg-card rounded-2xl p-6 shadow-card">
                  {step === 1 && (
                    <>
                      <ServiceSelector
                        services={formattedServices}
                        selectedService={selectedService}
                        onSelect={(id) => {
                          setSelectedService(id);
                          // Scroll to therapist assignment notice
                          setTimeout(() => {
                            const notice = document.getElementById('therapist-assignment-notice');
                            if (notice) {
                              notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 150);
                        }}
                      />

                      {/* Therapist Assignment Notice + Continue Button */}
                      {selectedService && (
                        <div className="mt-6 space-y-4">
                          <div id="therapist-assignment-notice" className="rounded-xl border-2 border-primary/40 bg-primary/10 p-4 transition-all duration-300 animate-[flash-glow_1.5s_ease-in-out]  shadow-[0_0_15px_hsl(var(--primary)/0.15)]">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center pulse">
                                  <UserRound className="w-4 h-4 text-primary" />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {t("gymPage.therapistAssignment")}
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {t("gymPage.therapistAssignmentDesc")}
                                </p>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setStep(2);
                              window.scrollTo(0, 0);
                            }}
                            className="btn-luxury-primary w-full h-12 rounded-xl font-display font-bold text-base"
                          >
                            {t("gymPage.understoodContinue")}
                          </button>
                        </div>
                      )}

                      {/* Notice shown before selection */}
                      {!selectedService && (
                        <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserRound className="w-4 h-4 text-primary" />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-semibold text-foreground">
                                {t("gymPage.therapistAssignment")}
                              </h4>
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {t("gymPage.therapistAssignmentDesc")}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {step === 2 && gymId && (
                    <ScheduleAwareTimeSlotPicker
                      gymId={gymId}
                      serviceDurationMinutes={services.find((s) => s.id === selectedService)?.duration_minutes || 30}
                      selectedDate={selectedDate}
                      selectedTime={selectedTime}
                      onSelectDate={setSelectedDate}
                      onSelectTime={setSelectedTime}
                    />
                  )}
                  {step === 3 && (
                    <>
                      <ClientInfoForm
                        clientInfo={clientInfo}
                        onChange={setClientInfo}
                      />

                      {/* Body Area Selection — Premium Druckintensität */}
                      <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                          {t("gymPage.pressureTitle")}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-1">
                          {t("gymPage.pressureDesc")}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mb-4">
                          {t("gymPage.pressureHint")}
                        </p>
                        <BodyDiagram
                          selectedAreas={selectedBodyAreas}
                          onToggleArea={handleToggleBodyArea}
                          onIntensityChange={handleIntensityChange}
                          onToggleFocus={handleToggleFocus}
                          disallowedAreas={disallowedAreas}
                          clientGender={inferGender(clientInfo.salutation)}
                          basePrice={getSelectedServicePrice()}
                          isUpgradeActive={deepTissueUpgradeActive}
                        />

                        {/* Live Intensity Pricing Box */}
                        {selectedBodyAreas.length > 0 && (
                          <div className="mt-4">
                            <IntensityPricingBox
                              basePrice={getSelectedServicePrice()}
                              selectedAreas={selectedBodyAreas}
                              isUpgradeActive={deepTissueUpgradeActive}
                              onRevertUpgrade={() => setDeepTissueUpgradeActive(false)}
                            />
                          </div>
                        )}
                      </div>

                      {/* Notes scroll nudge */}
                      {selectedBodyAreas.length > 0 && !(clientInfo.notes && clientInfo.notes.trim().length > 0) && (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => notesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border text-left transition-all bg-gradient-to-r from-primary/[0.08] to-accent/[0.08] border-primary/25 hover:border-primary/40"
                          >
                            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 shrink-0">
                              <ChevronDown className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-xs font-medium text-foreground flex-1">
                              {t("gymPage.notesNudge")}
                            </span>
                            <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                          </button>
                        </div>
                      )}

                      {/* Client Notes - after body diagram */}
                      <div ref={notesRef} className="mt-8 pt-6 border-t border-border">
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                          {t("gymPage.notesTitle")}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("gymPage.notesSubtitle")}
                        </p>
                        <textarea
                          placeholder={t("gymPage.notesPlaceholder")}
                          value={clientInfo.notes || ""}
                          onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                          maxLength={500}
                          rows={3}
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                        />
                        <p className="text-xs text-muted-foreground text-right mt-1">
                          {(clientInfo.notes || "").length}/500
                        </p>
                      </div>

                      {/* Communication Preference */}
                      <div className="mt-8 pt-6 border-t border-border">
                        <h3 className="font-display text-lg font-semibold text-foreground mb-1">
                          {t("gymPage.commPrefTitle")}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("gymPage.commPrefSubtitle")}
                        </p>
                        <div className="space-y-3">
                          {[
                            { value: "silent", label: t("gymPage.commSilent"), icon: "🤫" },
                            { value: "light_talk", label: t("gymPage.commLightTalk"), icon: "💬" },
                            { value: "normal", label: t("gymPage.commNormal"), icon: "🗣️" },
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={cn(
                                "w-full min-w-0 flex items-start sm:items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                communicationPreference === option.value
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                  : "border-border hover:border-primary/40 hover:bg-muted/30"
                              )}
                            >
                              <input
                                type="radio"
                                name="communication"
                                value={option.value}
                                checked={communicationPreference === option.value}
                                onChange={(e) => setCommunicationPreference(e.target.value)}
                                className="sr-only"
                              />
                              <span className="text-lg shrink-0 leading-none mt-0.5 sm:mt-0">{option.icon}</span>
                              <span className="flex-1 min-w-0 text-sm font-medium text-foreground whitespace-normal break-words leading-snug">{option.label}</span>
                              {communicationPreference === option.value && (
                                <Check className="w-4 h-4 text-primary ml-auto shrink-0 mt-0.5 sm:mt-0" />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>

                      <BotProtection
                        onVerified={handleVerification}
                        formLoadTime={formLoadTime}
                      />

                      {/* Final confirmations — unified elegant cards */}
                      <div className="mt-8 pt-6 border-t border-border space-y-3">
                        {/* Health Confirmation */}
                        <label
                          htmlFor="health-confirm"
                          className={`group flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 border bg-gradient-to-br from-accent/15 to-accent/5 ${
                            clientInfo.healthConfirmed
                              ? "border-primary/60 ring-2 ring-primary/30 shadow-sm"
                              : "border-accent/30 hover:border-primary/40 hover:shadow-sm"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                            clientInfo.healthConfirmed ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          }`}>
                            <HeartPulse className="h-4.5 w-4.5" strokeWidth={2.2} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id="health-confirm"
                                checked={clientInfo.healthConfirmed}
                                onCheckedChange={(checked) => setClientInfo({ ...clientInfo, healthConfirmed: checked === true })}
                                className="mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="text-sm text-foreground leading-relaxed">
                                {t("gymPage.healthConfirm")}
                              </span>
                            </div>
                          </div>
                        </label>

                        {/* Policy Acceptance */}
                        <label
                          htmlFor="policy-accept"
                          className={`group flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 border bg-gradient-to-br from-accent/15 to-accent/5 ${
                            policyAccepted
                              ? "border-primary/60 ring-2 ring-primary/30 shadow-sm"
                              : "border-accent/30 hover:border-primary/40 hover:shadow-sm"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                            policyAccepted ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          }`}>
                            <ScrollText className="h-4.5 w-4.5" strokeWidth={2.2} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id="policy-accept"
                                checked={policyAccepted}
                                onCheckedChange={(checked) => setPolicyAccepted(checked === true)}
                                className="mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <span className="text-sm text-foreground leading-relaxed">
                                {t("gymPage.policyAccept")}{" "}
                                <a
                                  href="/booking-policy"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                                >
                                  {t("gymPage.policyLink")}
                                </a>{" "}
                                {t("gymPage.policyAcceptEnd")}
                              </span>
                            </div>
                          </div>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Navigation — hidden on step 1 since "Verstanden & Weiter" handles it */}
                  {step > 1 && (
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                      <Button 
                        variant="outline" 
                        onClick={handleBack}
                        disabled={isNavigating || isProcessingPayment}
                      >
                        {t("gymPage.backBtn")}
                      </Button>
                      {step === 3 ? (
                        <Button 
                          variant="sage" 
                          onClick={handlePayment}
                          disabled={!canProceed || !selectedService || isProcessingPayment || isPaymentLoading}
                          className="min-w-[140px]"
                        >
                          {isProcessingPayment ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t("gymPage.loading")}
                            </>
                          ) : (
                            t("gymPage.toPayment")
                          )}
                        </Button>
                      ) : (
                        <Button 
                          variant="sage" 
                          onClick={handleNext} 
                          disabled={!canProceed || isNavigating}
                          className="min-w-[100px]"
                        >
                          {isNavigating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t("gymPage.nextBtn")
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Summary */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-2xl p-6 shadow-card sticky top-24">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                    {t("gymPage.summary")}
                  </h3>
                  
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("gymPage.location")}</span>
                      <span className="font-medium text-foreground">{gym.name}</span>
                    </div>
                    
                    {selectedService && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("gymPage.service")}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%] truncate">
                          {(() => { const s = services.find((s) => s.id === selectedService); return s ? getServiceName(s) : ""; })()}
                        </span>
                      </div>
                    )}
                    
                    {selectedDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("gymPage.date")}</span>
                        <span className="font-medium text-foreground">
                          {format(parseISO(selectedDate), "d. MMM yyyy", { locale: de })}
                        </span>
                      </div>
                    )}
                    
                    {selectedTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("gymPage.time")}</span>
                        <span className="font-medium text-foreground">
                          {selectedTime} {t("gymPage.timeUnit", "Uhr")}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border mt-6 pt-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("gymPage.basePrice")}</span>
                      <span className="font-medium text-foreground">
                        {getSelectedServicePrice().toFixed(2)} €
                      </span>
                    </div>
                    {finalSurcharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {deepTissueUpgradeActive ? t("gymPage.deepTissueUpgrade") : t("gymPage.intensitySurcharge")}
                        </span>
                        <span className="font-medium text-primary">
                          +{finalSurcharge.toFixed(2)} €
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-border">
                      <span className="font-semibold text-foreground">{t("gymPage.total")}</span>
                      <span className="font-display text-2xl font-bold text-primary">
                        {(getSelectedServicePrice() + finalSurcharge).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <GymQRCode
                  gymId={gym.id}
                  gymName={gym.name}
                  cityName={gym.city?.name}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Deep Tissue Upgrade Upsell Modal */}
      <DeepTissueUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        individualTotal={intensityPricing.totalExtra}
        onActivateUpgrade={() => {
          setDeepTissueUpgradeActive(true);
          setShowUpgradeModal(false);
          setUpgradeModalDismissed(true);
          toast.success(t("gymPage.upgradeActivated"));
        }}
        onKeepIndividual={() => {
          setShowUpgradeModal(false);
          setUpgradeModalDismissed(true);
        }}
      />
    </div>
  );
};

export default GymPage;
