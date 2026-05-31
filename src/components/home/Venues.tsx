import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Hotel, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTilt } from "@/hooks/useTilt";

function VenueCard({ to, children }: { to: string; children: React.ReactNode }) {
  const ref = useTilt<HTMLAnchorElement>({ max: 7, scale: 1.015 });
  return (
    <div style={{ perspective: "1100px" }}>
      <Link
        ref={ref as any}
        to={to}
        className="group relative block glass rounded-2xl p-8 lg:p-10 border border-border/50 hover:border-primary/40 overflow-hidden card-premium"
      >
        <span
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{ background: "hsl(var(--gold) / 0.2)" }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), hsl(var(--cream) / 0.4), transparent 45%)",
            opacity: "var(--glare-opacity, 0)",
            mixBlendMode: "overlay",
          }}
          aria-hidden
        />
        {children}
      </Link>
    </div>
  );
}

const Venues = () => {
  const { t } = useTranslation();

  const venues = [
    {
      key: "gym",
      icon: Building2,
      to: "/cities",
      title: t("venues.gym.title"),
      description: t("venues.gym.description"),
      cta: t("venues.gym.cta"),
    },
    {
      key: "hotel",
      icon: Hotel,
      to: "/hotels",
      title: t("venues.hotel.title"),
      description: t("venues.hotel.description"),
      cta: t("venues.hotel.cta"),
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <span className="inline-block px-4 py-1 mb-4 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-widest uppercase">
            {t("venues.sectionBadge")}
          </span>
          <h2 className="font-display text-3xl lg:text-5xl font-bold mb-4">
            {t("venues.sectionTitle")}{" "}
            <span className="text-primary">{t("venues.sectionTitleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-base lg:text-lg">
            {t("venues.sectionSubtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {venues.map((v) => {
            const Icon = v.icon;
            return (
              <VenueCard key={v.key} to={v.to}>
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-primary/10">
                  <Icon className="w-8 h-8" />
                </div>
                <h3 className="relative font-display text-2xl lg:text-3xl font-bold mb-3">
                  {v.title}
                </h3>
                <p className="relative text-muted-foreground mb-6 leading-relaxed">
                  {v.description}
                </p>
                <Button variant="sage" size="sm" asChild>
                  <span className="relative inline-flex items-center gap-2">
                    {v.cta}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
                  </span>
                </Button>
              </VenueCard>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Venues;