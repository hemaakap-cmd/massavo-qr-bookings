import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Activity, Heart, Leaf, ArrowRight, Check, Clock, Loader2, Building, Hotel as HotelIcon } from "lucide-react";
import { useCountryServices } from "@/hooks/useCountryServices";
import { usePublicCountry } from "@/contexts/CountryContext";
import i18n from "@/i18n";
import { hasQRAccess } from "@/lib/qrAccess";

const iconMap: Record<string, typeof Activity> = {
  sports: Activity,
  recovery: Heart,
  relaxation: Leaf,
};

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  sports: { bg: "bg-sage-light", text: "text-sage", border: "border-sage/20" },
  recovery: { bg: "bg-gold-light", text: "text-gold", border: "border-gold/20" },
  relaxation: { bg: "bg-cream-dark", text: "text-charcoal", border: "border-charcoal/10" },
};

const Services = () => {
  const { t } = useTranslation();
  const { services, loading } = useCountryServices();
  const { formatPrice, selectedCountry } = usePublicCountry();
  const isAr = i18n.language === "ar";
  const showPrice = hasQRAccess();

  return (
    <div className="min-h-screen">
      <SEO
        title="Massage-Services – Sport, Klassisch & Wellness | MASSAVO"
        description="Entdecke unsere Massage-Services: Sportmassage, Klassische Massage und Entspannungsmassage. Direkt im Fitnessstudio oder Partnerhotel buchbar."
        path="/services"
        keywords="sportmassage, klassische massage, entspannungsmassage, wellness, massage services"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@graph": services.map((s) => ({
            "@type": "Service",
            name: isAr && s.name_ar ? s.name_ar : s.name,
            description: isAr && s.description_ar ? s.description_ar : (s.description || ""),
            provider: { "@type": "Organization", name: "MASSAVO", url: "https://massavo.com" },
            areaServed: { "@type": "Country", name: selectedCountry?.name || "Germany" },
          })),
        })}</script>
      </Helmet>
      <Header />
      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 bg-gradient-hero">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 rounded-full bg-cream/20 text-cream text-sm font-medium mb-6 animate-fade-up">
                {t("servicesPage.badge")}
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-cream leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                {t("servicesPage.title")}
                <br />
                <span className="text-gold">{t("servicesPage.titleHighlight")}</span>
              </h1>
              <p className="text-lg md:text-xl text-cream/90 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
                {t("servicesPage.subtitle")}
              </p>
            </div>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-20 md:py-28 bg-background">
          <div className="container mx-auto px-4">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">{t("servicesPage.noServices")}</p>
              </div>
            ) : (
              <div className="space-y-16">
                {services.map((service, index) => {
                  const iconKey = service.icon || "relaxation";
                  const Icon = iconMap[iconKey] || Leaf;
                  const colors = colorClasses[iconKey] || colorClasses.relaxation;
                  const isEven = index % 2 === 0;
                  const serviceName = isAr && service.name_ar ? service.name_ar : service.name;
                  const serviceDesc = isAr && service.description_ar ? service.description_ar : (service.description || "");

                  return (
                    <div
                      key={service.id}
                      className={`grid lg:grid-cols-2 gap-8 lg:gap-12 items-center animate-fade-up`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className={isEven ? "" : "lg:order-2"}>
                        <div className={`w-16 h-16 rounded-2xl ${colors.bg} flex items-center justify-center mb-6`}>
                          <Icon className={`w-8 h-8 ${colors.text}`} />
                        </div>
                        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
                          {serviceName}
                        </h2>
                        <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                          {serviceDesc}
                        </p>
                        <div className="flex flex-wrap gap-4 mb-6">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="text-muted-foreground">{t("servicesPage.duration")}:</span>
                            <span className="font-semibold text-foreground">{service.duration_minutes} min</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t("servicesPage.price")}:</span>
                            {showPrice ? (
                              <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                            ) : (
                              <span className="text-sm italic text-muted-foreground">
                                {t("qrGate.pricingLocked")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <Button variant="sage" asChild>
                            <Link to="/cities">
                              <Building className="w-4 h-4" />
                              {t("servicesPage.bookAtGym")}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button variant="luxuryOutline" asChild>
                            <Link to="/hotels">
                              <HotelIcon className="w-4 h-4" />
                              {t("servicesPage.bookAtHotel")}
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>

                      <div className={`${isEven ? "lg:order-2" : ""}`}>
                        <div className={`bg-card rounded-2xl p-6 border ${colors.border}`}>
                          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Check className={`w-4 h-4 ${colors.text}`} />
                            {t("servicesPage.highlights")}
                          </h4>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {serviceDesc}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-28 bg-gradient-hero">
          <div className="container mx-auto px-4 text-center">
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-cream mb-4">
              {t("servicesPage.cta.title")}
            </h2>
            <p className="text-cream/80 text-lg mb-8 max-w-xl mx-auto">
              {t("servicesPage.cta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button variant="gold" size="lg" asChild>
                <Link to="/cities">
                  <Building className="w-5 h-5" />
                  {t("servicesPage.cta.gymButton")}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="luxuryOutline" size="lg" asChild>
                <Link to="/hotels">
                  <HotelIcon className="w-5 h-5" />
                  {t("servicesPage.cta.hotelButton")}
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Services;
