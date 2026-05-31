import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTilt } from "@/hooks/useTilt";
import comparisonImg from "@/assets/massage-comparison-v5.png";

function CompareCard({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "destructive";
}) {
  const ref = useTilt<HTMLDivElement>({ max: 5, scale: 1.012 });
  const ring =
    tone === "success"
      ? "border-success/20 hover:border-success/40"
      : "border-destructive/20 hover:border-destructive/40";
  return (
    <div style={{ perspective: "1100px" }}>
      <div
        ref={ref}
        className={`group relative bg-card/80 backdrop-blur-sm rounded-xl border ${ring} p-5 transition-all hover:shadow-xl card-premium overflow-hidden`}
      >
        <span className="glare-overlay" aria-hidden />
        {children}
      </div>
    </div>
  );
}

export default function WhyMassageMatters() {
  const { t } = useTranslation();

  const benefitDetails = [
    { title: t("whyMassage.benefit1Title"), desc: t("whyMassage.benefit1Desc") },
    { title: t("whyMassage.benefit2Title"), desc: t("whyMassage.benefit2Desc") },
    { title: t("whyMassage.benefit3Title"), desc: t("whyMassage.benefit3Desc") },
  ];

  const riskDetails = [
    { title: t("whyMassage.risk1Title"), desc: t("whyMassage.risk1Desc") },
    { title: t("whyMassage.risk2Title"), desc: t("whyMassage.risk2Desc") },
    { title: t("whyMassage.risk3Title"), desc: t("whyMassage.risk3Desc") },
  ];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-muted/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.04),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.05),transparent_60%)]" />

      <div className="container relative mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-4">
            {t("whyMassage.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {t("whyMassage.title")}{" "}
            <span className="text-accent">{t("whyMassage.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {t("whyMassage.subtitle")}
          </p>
        </div>

        {/* Main comparison layout */}
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-0 max-w-6xl mx-auto items-start">

          {/* Left: Benefits */}
          <div className="space-y-5 lg:pr-8 order-2 lg:order-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-success" />
              <h3 className="font-display text-xl font-bold text-foreground">
                {t("whyMassage.withMassage")}
              </h3>
            </div>
            {benefitDetails.map((b) => (
              <CompareCard key={b.title} tone="success">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                    <CheckCircle className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">{b.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              </CompareCard>
            ))}
          </div>

          {/* Center: Image */}
          <div className="order-1 lg:order-2 lg:mx-4">
            <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-2xl bg-card max-w-md mx-auto animate-float-soft">
              {/* Ambient aura behind comparison */}
              <span
                className="pointer-events-none absolute -inset-8 rounded-3xl blur-3xl opacity-60"
                style={{ background: "radial-gradient(circle, hsl(var(--gold) / 0.18), transparent 70%)" }}
                aria-hidden
              />
              <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-card/60 to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/60 to-transparent z-10 pointer-events-none" />
              
              <img
                src={comparisonImg}
                alt={t("whyMassage.imageAlt")}
                // Below-the-fold marketing image. Native dims 1024x1024.
                // Explicit dimensions prevent CLS as the heavy PNG streams in.
                width={1024}
                height={1024}
                loading="lazy"
                decoding="async"
                className="relative w-full h-auto object-contain"
              />

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <div className="w-12 h-12 rounded-full bg-accent/90 backdrop-blur-sm flex items-center justify-center shadow-lg border-2 border-accent-foreground/20">
                  <span className="text-accent-foreground font-display font-bold text-xs">VS</span>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-muted-foreground mt-3 max-w-sm mx-auto italic">
              {t("whyMassage.imageCaption")}
            </p>
          </div>

          {/* Right: Risks */}
          <div className="space-y-5 lg:pl-8 order-3">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <h3 className="font-display text-xl font-bold text-foreground">
                {t("whyMassage.withoutMassage")}
              </h3>
            </div>
            {riskDetails.map((r) => (
              <CompareCard key={r.title} tone="destructive">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">{r.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              </CompareCard>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14">
          <div className="relative inline-block">
            <span className="cta-aura rounded-full" aria-hidden />
            <Button variant="default" size="lg" asChild className="relative group shine-sweep overflow-hidden">
              <Link to="/cities">
                {t("whyMassage.cta")}
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t("whyMassage.ctaSub")}
          </p>
        </div>
      </div>
    </section>
  );
}
