import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MapPin, QrCode, Clock, Hotel, ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-massage.jpg";
import { supabase } from "@/integrations/supabase/client";
import { usePublicCountry } from "@/contexts/CountryContext";
import { useTilt } from "@/hooks/useTilt";
import { useParallax } from "@/hooks/useParallax";

const Hero = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  const { selectedCountry } = usePublicCountry();
  const [cityCount, setCityCount] = useState<number | null>(null);
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const cardTiltRef = useTilt<HTMLDivElement>({ max: 10, scale: 1.02 });
  const bgParallaxRef = useParallax<HTMLDivElement>(0.18);
  const glowParallaxRef = useParallax<HTMLDivElement>(-0.35);

  useEffect(() => {
    async function fetchStats() {
      let citiesQuery = supabase.from("cities").select("id", { count: "exact", head: true }).eq("is_active", true);
      let servicesQuery = supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true);

      if (selectedCountry?.id) {
        citiesQuery = citiesQuery.eq("country_id", selectedCountry.id);
        servicesQuery = servicesQuery.eq("country_id", selectedCountry.id);
      }

      const [citiesRes, servicesRes] = await Promise.all([citiesQuery, servicesQuery]);
      if (citiesRes.count != null) setCityCount(citiesRes.count);
      if (servicesRes.count != null) setServiceCount(servicesRes.count);
    }
    fetchStats();
  }, [selectedCountry?.id]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <div ref={bgParallaxRef} className="absolute inset-0 will-change-transform">
        <img
          src={heroImage}
          alt="Premium massage therapy room"
          // LCP candidate. Explicit dimensions kill the layout shift while the
          // image streams in; fetchpriority=high beats the Lighthouse penalty
          // for un-hinted hero images. Native source dims are 1920x1080.
          width={1920}
          height={1080}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="w-full h-full object-cover scale-105 animate-aura"
          style={{ animationDuration: "12s" }}
        />
        </div>
        <div className="absolute inset-0 bg-gradient-hero" />
        {/* Cinematic ambient glow accents */}
        <div ref={glowParallaxRef} className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/4 -right-32 w-[560px] h-[560px] rounded-full blur-[120px] animate-slow-drift"
            style={{ background: "hsl(var(--gold) / 0.22)" }}
            aria-hidden
          />
        </div>
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 w-[480px] h-[480px] rounded-full blur-[110px]"
          style={{ background: "hsl(var(--sage-dark) / 0.35)", animation: "slow-drift 22s ease-in-out infinite reverse" }}
          aria-hidden
        />
        {/* Cinematic light streak */}
        <div
          className="pointer-events-none absolute -top-32 left-1/3 w-[140%] h-64 rotate-[8deg] opacity-30 mix-blend-screen"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, hsl(var(--gold) / 0.35) 40%, hsl(var(--cream) / 0.55) 50%, hsl(var(--gold) / 0.35) 60%, transparent 100%)",
            filter: "blur(40px)",
          }}
          aria-hidden
        />
        {/* Subtle film grain for depth */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
          aria-hidden
        />
        {/* Floating luxury particle orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {[
            { left: "12%", bottom: "8%", size: 10, dur: "11s", delay: "0s", x: "30px", c: "var(--gold)" },
            { left: "28%", bottom: "4%", size: 6, dur: "9s", delay: "1.5s", x: "-20px", c: "var(--cream)" },
            { left: "46%", bottom: "12%", size: 14, dur: "13s", delay: "3s", x: "40px", c: "var(--gold)" },
            { left: "62%", bottom: "6%", size: 8, dur: "10s", delay: "0.8s", x: "-30px", c: "var(--cream)" },
            { left: "78%", bottom: "10%", size: 12, dur: "12s", delay: "2.2s", x: "20px", c: "var(--gold)" },
            { left: "88%", bottom: "3%", size: 7, dur: "9.5s", delay: "4s", x: "-15px", c: "var(--cream)" },
          ].map((o, i) => (
            <span
              key={i}
              className="orb"
              style={{
                left: o.left,
                bottom: o.bottom,
                width: o.size,
                height: o.size,
                background: `hsl(${o.c} / 0.7)`,
                boxShadow: `0 0 20px hsl(${o.c} / 0.6)`,
                ["--orb-dur" as never]: o.dur,
                ["--orb-delay" as never]: o.delay,
                ["--orb-x" as never]: o.x,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="container relative mx-auto px-4 pt-20">
        <div className="max-w-3xl">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cream/10 backdrop-blur-sm text-cream text-sm font-medium mb-6 border border-cream/20">
              <QrCode className="w-4 h-4" />
              {t("howItWorks.badge")}
            </span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-cream leading-tight mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {t("hero.title")}
            <br />
            <span className="text-gold-shimmer">{t("hero.titleHighlight")}</span>
          </h1>

          <p className="text-lg md:text-xl text-cream/90 max-w-xl mb-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {t("hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <Button asChild size="xl" variant="hero" className="group">
              <Link to="/cities">
                <MapPin className="w-5 h-5" strokeWidth={2.4} />
                <span>{t("hero.cta")}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="hero" className="group">
              <Link to="/hotels">
                <Hotel className="w-5 h-5" strokeWidth={2.2} />
                <span>{t("hero.secondary")}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="hero" className="group">
              <Link to="/home-visit">
                <Home className="w-5 h-5" strokeWidth={2.2} />
                <span>{t("venues.home.cta", "Hausbesuch buchen")}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </Link>
            </Button>
          </div>

          {/* Stats - Real data */}
          <div className="grid grid-cols-3 gap-6 mt-16 pt-8 border-t border-cream/20 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            {[
              { value: cityCount !== null ? String(cityCount) : "—", label: t("about.stats.cities") },
              { value: serviceCount !== null ? String(serviceCount) : "—", label: t("stats.services") },
              { value: t("stats.newLabel"), label: t("stats.since") },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-3xl md:text-4xl font-bold text-cream">{stat.value}</div>
                <div className="text-cream/70 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Card */}
      <div className="hero-float-card hidden xl:block absolute right-16 top-1/2 -translate-y-1/2 w-80 animate-slide-in-right" style={{ animationDelay: "0.5s" }}>
        <div className="relative group animate-float-soft" style={{ perspective: "1200px" }}>
          <span
            className="pointer-events-none absolute -inset-4 rounded-[2.5rem] blur-3xl opacity-50 group-hover:opacity-90 transition-opacity duration-700"
            style={{ background: "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.35) 0%, transparent 70%)" }}
            aria-hidden
          />
          {/* Depth shadow plate */}
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl translate-y-4 scale-95 opacity-60 blur-2xl"
            style={{ background: "hsl(var(--charcoal) / 0.5)" }}
            aria-hidden
          />
          <div
            ref={cardTiltRef}
            className="relative bg-card/95 backdrop-blur-2xl rounded-2xl p-6 shadow-hero ring-1 ring-cream/20 overflow-hidden"
          >
            {/* Glare layer */}
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
              style={{
                background:
                  "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), hsl(var(--cream) / 0.35), transparent 45%)",
                opacity: "var(--glare-opacity, 0)",
                mixBlendMode: "overlay",
              }}
              aria-hidden
            />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-sage-light flex items-center justify-center">
              <Clock className="w-6 h-6 text-sage" />
            </div>
            <div>
              <div className="font-semibold text-foreground">{t("howItWorks.title")} {t("howItWorks.titleHighlight")}</div>
              <div className="text-sm text-muted-foreground">{t("howItWorks.subtitle")}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-cream text-xs">1</div>
              <span className="text-muted-foreground">{t("howItWorks.step1.title")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-cream text-xs">2</div>
              <span className="text-muted-foreground">{t("howItWorks.step2.title")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-sage flex items-center justify-center text-cream text-xs">3</div>
              <span className="text-muted-foreground">{t("howItWorks.step3.title")}</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  );
});

Hero.displayName = "Hero";

export default Hero;
