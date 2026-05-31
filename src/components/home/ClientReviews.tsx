import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Quote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { usePublicCountry } from "@/contexts/CountryContext";

interface Review {
  id: string;
  customer_first_name: string | null;
  therapist_rating: number;
  service_rating: number;
  comment: string | null;
  submitted_at: string;
  gym_id: string;
  gym_name?: string;
}

const Stars = ({ count }: { count: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= count ? "fill-accent text-accent" : "text-muted-foreground/20"}`} />
    ))}
  </div>
);

export default function ClientReviews() {
  const { selectedCountry } = usePublicCountry();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "de" ? de : enUS;
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!selectedCountry?.id) return;

      // Use SECURITY DEFINER RPC — booking_feedback is REVOKEd from anon (security hardening)
      const { data } = await supabase.rpc("get_public_reviews", {
        p_country_id: selectedCountry.id,
        p_limit: 6,
      });
      setReviews(((data as unknown) as Review[]) || []);
    };

    fetchReviews();

    const channel = supabase
      .channel("public-reviews")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_feedback" }, () => {
        fetchReviews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCountry?.id]);

  if (reviews.length === 0) return null;

  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">{t("clientReviews.title")}</h2>
          <p className="text-muted-foreground">{t("clientReviews.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {reviews.map((r) => {
            const avg = Math.round(((r.therapist_rating || 0) + (r.service_rating || 0)) / 2);
            return (
              <Card key={r.id} className="relative overflow-hidden">
                <CardContent className="p-5">
                  <Quote className="w-6 h-6 text-accent/20 absolute top-4 right-4" />
                  <Stars count={avg} />
                  {r.comment && (
                    <p className="text-sm text-foreground/80 mt-3 line-clamp-4 leading-relaxed">
                      "{r.comment}"
                    </p>
                  )}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.customer_first_name || t("clientReviews.anonymous")}</p>
                      {r.gym_name && <p className="text-xs text-muted-foreground">{r.gym_name}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.submitted_at ? format(new Date(r.submitted_at), "dd. MMM yyyy", { locale: dateLocale }) : ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
