import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Star, BarChart3, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePublicCountry } from "@/contexts/CountryContext";

interface TherapistData {
  name: string;
  rating: number | null;
  score: number | null;
}

interface TopReview {
  comment: string;
  customer_first_name: string | null;
  avg: number;
}

function usePerformanceData() {
  const { selectedCountry } = usePublicCountry();
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [topReview, setTopReview] = useState<TopReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!selectedCountry?.id) return;

      try {
        const { data, error } = await supabase.functions.invoke("get-home-performance", {
          body: { country_id: selectedCountry.id },
        });

        if (error) throw error;

        setTherapists((data?.therapists || []) as TherapistData[]);
        setTopReview((data?.topReview || null) as TopReview | null);
      } catch (err) {
        console.error("Failed to fetch performance data:", err);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchData();
  }, [selectedCountry?.id]);

  return { therapists, topReview, loading };
}

function DashboardMockup({ t }: { t: (key: string) => string }) {
  const { therapists, topReview, loading } = usePerformanceData();
  const displayTherapists = therapists.slice(0, 3);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent rounded-3xl blur-2xl" />

      <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-gold/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
          </div>
          <span className="text-[10px] text-muted-foreground ml-2 font-mono">massavo.com/admin/therapist-analytics</span>
        </div>

        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">{t("performance.therapistPerformance")}</h4>
              <p className="text-[11px] text-muted-foreground">{t("performance.liveData")}</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-success font-medium">Live</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 pb-4">
          <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
            <Star className="w-3.5 h-3.5 text-accent mb-1.5" />
            <div className="text-lg font-bold text-foreground leading-none">
              {loading ? "—" : therapists.length > 0 && therapists[0].rating ? `${Number(therapists[0].rating).toFixed(1)}★` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{t("performance.avgRating")}</div>
          </div>
          <div className="bg-muted/40 rounded-xl p-3 border border-border/30">
            <Users className="w-3.5 h-3.5 text-accent mb-1.5" />
            <div className="text-lg font-bold text-foreground leading-none">
              {loading ? "—" : therapists.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{t("performance.activeTherapists")}</div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>{t("performance.therapistCol")}</span>
              <span>{t("performance.rankCol")}</span>
            </div>
            {loading ? (
              <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">{t("gymPage.loading")}</div>
            ) : displayTherapists.length === 0 ? (
              <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">—</div>
            ) : (
              displayTherapists.map((th) => (
                <div
                  key={th.name}
                  className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 items-center border-t border-border/20"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                      {th.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {th.name.split(" ")[0]} {th.name.split(" ")[1]?.charAt(0) ? `${th.name.split(" ")[1].charAt(0)}.` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <Star
                          key={i}
                          className={`w-2.5 h-2.5 ${
                            i <= Math.floor(Number(th.rating || 0))
                              ? "text-gold fill-gold"
                              : i - 0.5 <= Number(th.rating || 0)
                              ? "text-gold fill-gold/50"
                              : "text-muted-foreground/20"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="ml-1">{th.rating ? Number(th.rating).toFixed(1) : "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {topReview && (
            <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-3.5 h-3.5 text-accent fill-accent" />
                <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">{t("performance.topReview")}</span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3 italic">
                „{topReview.comment}"
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground font-medium">
                  — {topReview.customer_first_name || t("performance.customer")}
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-3 h-3 ${i <= Math.round(topReview.avg) ? "fill-gold text-gold" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PerformanceShowcase() {
  const { t } = useTranslation();

  const benefits = [
    { icon: Star, title: t("performance.benefit1Title"), desc: t("performance.benefit1Desc") },
    { icon: BarChart3, title: t("performance.benefit2Title"), desc: t("performance.benefit2Desc") },
  ];

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.06),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.04),transparent_60%)]" />

      <div className="container relative mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold tracking-wide uppercase mb-4">
            {t("performance.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
            {t("performance.title")}{" "}
            <span className="text-accent">{t("performance.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {t("performance.subtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-8 order-2 lg:order-1">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-4 group">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <b.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{b.title}</h3>
                  <p className="text-muted-foreground text-sm mt-1">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="order-1 lg:order-2">
            <DashboardMockup t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}
