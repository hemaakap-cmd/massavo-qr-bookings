import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Activity, Heart, Leaf, ArrowRight, Loader2 } from "lucide-react";
import { useCountryServices } from "@/hooks/useCountryServices";
import { usePublicCountry } from "@/contexts/CountryContext";
import i18n from "@/i18n";
import { hasQRAccess } from "@/lib/qrAccess";
import { useTilt } from "@/hooks/useTilt";

const iconMap: Record<string, typeof Activity> = {
  sports: Activity,
  recovery: Heart,
  relaxation: Leaf,
};

const colorMap: Record<string, string> = {
  sports: "bg-sage-light text-sage",
  recovery: "bg-gold-light text-gold",
  relaxation: "bg-cream-dark text-charcoal",
};

function ServiceCard({ children, delay }: { children: React.ReactNode; delay: number }) {
  const ref = useTilt<HTMLDivElement>({ max: 6, scale: 1.01 });
  return (
    <div className="animate-fade-up" style={{ animationDelay: `${delay}s`, perspective: "1100px" }}>
      <div
        ref={ref}
        className="group relative bg-card rounded-2xl p-8 card-premium overflow-hidden ring-1 ring-border/60"
      >
        {/* Glare layer */}
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), hsl(var(--cream) / 0.45), transparent 40%)",
            opacity: "var(--glare-opacity, 0)",
            mixBlendMode: "overlay",
          }}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

const Services = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  const { services, loading } = useCountryServices();
  const { formatPrice } = usePublicCountry();
  const isAr = i18n.language === "ar";
  const showPrice = hasQRAccess();

  return (
    <section ref={ref} className="py-24 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-sage-light text-sage text-sm font-medium mb-4">
            {t("services.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            {t("services.title")}
            <br />
            <span className="text-primary">{t("services.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("services.subtitle")}
          </p>
        </div>

        {/* Service Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {t("services.noServices", "No services available yet.")}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {services.slice(0, 3).map((service, index) => {
              const iconKey = service.icon || "relaxation";
              const Icon = iconMap[iconKey] || Leaf;
              const serviceName = isAr && service.name_ar ? service.name_ar : service.name;
              const serviceDesc = isAr && service.description_ar ? service.description_ar : (service.description || "");

              return (
                <ServiceCard key={service.id} delay={index * 0.1}>
                  {/* Soft gold aura on hover */}
                  <span
                    className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{ background: "hsl(var(--gold) / 0.18)" }}
                    aria-hidden
                  />

                  {/* Icon */}
                  <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 ${colorMap[iconKey] || colorMap.relaxation}`}>
                    <Icon className="w-7 h-7" />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                    {serviceName}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3">
                    {serviceDesc}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm mb-6">
                    <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
                      {service.duration_minutes} min
                    </span>
                    {showPrice ? (
                      <span className="font-semibold text-primary">{formatPrice(service.price)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {t("qrGate.pricingLocked")}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <Button variant="ghost" className="group/btn p-0 h-auto text-primary hover:bg-transparent" asChild>
                    <Link to="/services" className="relative">
                      {t("services.learnMore")}
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover/btn:translate-x-1 rtl:rotate-180" />
                    </Link>
                  </Button>

                  {/* Gold underline reveal */}
                  <span
                    className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-700 ease-out"
                    style={{ background: "linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)" }}
                    aria-hidden
                  />
                </ServiceCard>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-12">
          <Button variant="sage" size="lg" asChild>
            <Link to="/services">
              {t("services.viewAll")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

Services.displayName = "Services";

export default Services;
