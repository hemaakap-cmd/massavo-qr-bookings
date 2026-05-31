import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { QrCode, Calendar, CreditCard, Sparkles } from "lucide-react";
import { useTilt } from "@/hooks/useTilt";

function StepCard({
  children,
  index,
  step,
}: {
  children: React.ReactNode;
  index: number;
  step: string;
}) {
  const ref = useTilt<HTMLDivElement>({ max: 6, scale: 1.015 });
  return (
    <div
      className="relative animate-fade-up"
      style={{ animationDelay: `${index * 0.1}s`, perspective: "1100px" }}
    >
      {/* Step Number - outside overflow-hidden so it's never clipped */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 bg-sage text-cream text-xs font-bold rounded-full shadow-md shadow-sage/40 ring-1 ring-gold/30">
        {step}
      </div>
      <div
        ref={ref}
        className="group relative bg-card rounded-2xl p-8 text-center shadow-card card-premium overflow-hidden ring-1 ring-border/50"
      >
        <span className="glare-overlay" aria-hidden />
        {/* Soft gold aura on hover */}
        <span
          className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{ background: "hsl(var(--gold) / 0.15)" }}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

const HowItWorks = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();

  const steps = [
    {
      icon: QrCode,
      step: "01",
      titleKey: "howItWorks.step1.title",
      descriptionKey: "howItWorks.step1.description",
    },
    {
      icon: Calendar,
      step: "02",
      titleKey: "howItWorks.step2.title",
      descriptionKey: "howItWorks.step2.description",
    },
    {
      icon: CreditCard,
      step: "03",
      titleKey: "howItWorks.step3.title",
      descriptionKey: "howItWorks.step3.description",
    },
    {
      icon: Sparkles,
      step: "04",
      titleKey: "howItWorks.step4.title",
      descriptionKey: "howItWorks.step4.description",
    },
  ];

  return (
    <section ref={ref} className="py-24 bg-sage-light">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-sage/10 text-sage text-sm font-medium mb-4">
            {t("howItWorks.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            {t("howItWorks.title")} <span className="text-primary">{t("howItWorks.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("howItWorks.subtitle")}
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
          <StepCard key={step.step} index={index} step={step.step}>
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-10 left-full w-8 h-0.5 bg-gradient-to-r from-gold/40 to-transparent" />
              )}

                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-sage-light mx-auto flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                  <step.icon className="w-8 h-8 text-sage" />
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  {t(step.titleKey)}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(step.descriptionKey)}
                </p>
              {/* Gold underline reveal */}
              <span
                className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-700 ease-out"
                style={{ background: "linear-gradient(90deg, transparent, hsl(var(--gold)), transparent)" }}
                aria-hidden
              />
            </StepCard>
          ))}
        </div>
      </div>
    </section>
  );
});

HowItWorks.displayName = "HowItWorks";

export default HowItWorks;
