import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const StarRating = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-foreground">{label}</p>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 transition-colors ${star <= value ? "fill-accent text-accent" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  </div>
);

const Feedback = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [therapistRating, setTherapistRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container max-w-lg mx-auto px-4 py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("feedbackPage.invalidLink")}</h1>
          <p className="text-muted-foreground">{t("feedbackPage.invalidLinkDesc")}</p>
        </main>
        <Footer />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (therapistRating === 0 || serviceRating === 0) {
      toast.error(t("feedbackPage.rateBoth"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            therapist_rating: therapistRating,
            service_rating: serviceRating,
            comment: comment.trim() || null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setSubmitted(true);
          return;
        }
        throw new Error(data.error || t("feedbackPage.sendError"));
      }

      setSubmitted(true);
      toast.success(t("feedbackPage.thanksToast"));
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container max-w-lg mx-auto px-4 py-20 text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t("feedbackPage.thanksTitle")}</h1>
          <p className="text-muted-foreground">{t("feedbackPage.thanksDesc")}</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">{t("feedbackPage.title")}</h1>
          <p className="text-muted-foreground">{t("feedbackPage.subtitle")}</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <StarRating label={t("feedbackPage.therapistLabel")} value={therapistRating} onChange={setTherapistRating} />
            <StarRating label={t("feedbackPage.qualityLabel")} value={serviceRating} onChange={setServiceRating} />

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{t("feedbackPage.commentLabel")}</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                placeholder={t("feedbackPage.commentPlaceholder")}
                className="resize-none"
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || therapistRating === 0 || serviceRating === 0}
              className="w-full"
              size="lg"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2" />}
              {t("feedbackPage.submit")}
            </Button>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Feedback;
