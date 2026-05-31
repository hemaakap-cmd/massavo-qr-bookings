import { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface Review {
  author_name: string;
  rating: number;
  text: string;
  relative_time_description: string;
  profile_photo_url: string;
}

interface ReviewData {
  reviews: Review[];
  rating: number;
  total_ratings: number;
}

const GoogleReviews = forwardRef<HTMLElement>((_, ref) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke('get-google-reviews');
        if (error) throw error;
        setData(result);
      } catch (e) {
        console.error('Failed to fetch reviews:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchReviews();
  }, []);

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'fill-gold text-gold' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );

  return (
    <section ref={ref} className="py-20 md:py-28 bg-cream">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sage/10 text-sage text-sm font-medium mb-4">
            <Star className="w-4 h-4 fill-gold text-gold" />
            {t("googleReviews.badge")}
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            {t("googleReviews.title")}
          </h2>
          {data && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-lg">
              {renderStars(Math.round(data.rating))}
              <span>
                {t("googleReviews.ratingText", { rating: data.rating, count: data.total_ratings })}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-none shadow-md bg-card">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))
            : data?.reviews.map((review, i) => (
                <Card key={i} className="border-none shadow-md bg-card hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={review.profile_photo_url} alt={review.author_name} />
                        <AvatarFallback className="bg-sage text-cream text-sm">
                          {review.author_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{review.author_name}</p>
                        <p className="text-xs text-muted-foreground">{review.relative_time_description}</p>
                      </div>
                    </div>
                    {renderStars(review.rating)}
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-4">
                      {review.text}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </section>
  );
});

GoogleReviews.displayName = "GoogleReviews";

export default GoogleReviews;
