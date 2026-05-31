import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight } from "lucide-react";

const CTASection = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();

  return (
    <section ref={ref} className="py-24 bg-sage relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 rounded-full bg-cream blur-3xl animate-slow-drift" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-gold blur-3xl animate-slow-drift" style={{ animationDelay: "-4s" }} />
      </div>

      {/* Floating particle orbs */}
      <span className="orb" style={{ left: "10%", bottom: "12%", width: 10, height: 10, background: "hsl(var(--gold) / 0.6)", ['--orb-x' as any]: "30px", ['--orb-dur' as any]: "11s", ['--orb-delay' as any]: "0s" } as React.CSSProperties} aria-hidden />
      <span className="orb" style={{ left: "32%", bottom: "8%", width: 7, height: 7, background: "hsl(var(--cream) / 0.55)", ['--orb-x' as any]: "-20px", ['--orb-dur' as any]: "13s", ['--orb-delay' as any]: "-3s" } as React.CSSProperties} aria-hidden />
      <span className="orb" style={{ left: "62%", bottom: "10%", width: 12, height: 12, background: "hsl(var(--gold) / 0.5)", ['--orb-x' as any]: "40px", ['--orb-dur' as any]: "15s", ['--orb-delay' as any]: "-7s" } as React.CSSProperties} aria-hidden />
      <span className="orb" style={{ left: "85%", bottom: "14%", width: 8, height: 8, background: "hsl(var(--cream) / 0.5)", ['--orb-x' as any]: "-30px", ['--orb-dur' as any]: "12s", ['--orb-delay' as any]: "-5s" } as React.CSSProperties} aria-hidden />

      <div className="container relative mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-cream mb-6">
            {t("cta.title")}
            <br />
            <span className="text-gold-shimmer">{t("cta.titleHighlight")}</span>
          </h2>
          <p className="text-cream/80 text-lg mb-10 max-w-xl mx-auto">
            {t("cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="relative">
              <span className="cta-aura rounded-full" aria-hidden />
              <Button variant="hero" size="xl" asChild className="relative shine-sweep overflow-hidden">
                <Link to="/cities">
                  <MapPin className="w-5 h-5" />
                  {t("cta.button")}
                </Link>
              </Button>
            </div>
            <Button
              variant="ghost"
              size="xl"
              asChild
              className="text-cream hover:bg-cream/10"
            >
              <Link to="/about">
                {t("cta.secondary")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
});

CTASection.displayName = "CTASection";

export default CTASection;
