import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Calendar, MapPin, Clock, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BookingQRCard from "@/components/booking/BookingQRCard";

const PaymentSuccess = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [cancellationToken, setCancellationToken] = useState<string | null>(null);
  const bodyAreasSavedRef = useRef(false);
  const verifyCalledRef = useRef(false);

  useEffect(() => {
    const verifyPayment = async () => {
      if (verifyCalledRef.current) return;
      verifyCalledRef.current = true;
      
      const sessionId = searchParams.get("session_id");
      
      if (!sessionId) {
        setIsVerifying(false);
        setBookingConfirmed(true);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { sessionId },
        });

        if (error) {
          console.error("Verification error:", error);
          setVerificationError(t("paymentSuccess.verifyError"));
        } else if (data?.slotTaken) {
          setVerificationError(data.error || t("paymentSuccess.slotTaken"));
        } else if (data?.success) {
          setBookingConfirmed(true);
          if (data.bookingId) setBookingId(data.bookingId);
          if (data.cancellationToken) setCancellationToken(data.cancellationToken);
          
          if (data.bookingId && !bodyAreasSavedRef.current) {
            bodyAreasSavedRef.current = true;
            try {
              const stored = localStorage.getItem("massavo_body_areas");
              const commPref = localStorage.getItem("massavo_comm_pref");
              const areas = stored ? JSON.parse(stored) : [];
              const hasAreas = Array.isArray(areas) && areas.length > 0;
              const hasCommPref = !!commPref;

              if (hasAreas || hasCommPref) {
                const { error: saveErr } = await supabase.functions.invoke("save-body-areas", {
                  body: { 
                    bookingId: data.bookingId, 
                    areas: hasAreas ? areas : [],
                    ...(hasCommPref ? { communicationPreference: commPref } : {}),
                  },
                });
                if (saveErr) {
                  console.error("Save error:", saveErr);
                } else {
                  if (hasAreas) localStorage.removeItem("massavo_body_areas");
                  if (hasCommPref) localStorage.removeItem("massavo_comm_pref");
                }
              }
            } catch (e) {
              console.error("Save error:", e);
            }
          }
        } else {
          setVerificationError(data?.error || "Payment verification failed");
        }
      } catch (err) {
        console.error("Verification exception:", err);
        setVerificationError(t("paymentSuccess.verifyError"));
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="max-w-lg mx-auto text-center">
                <Loader2 className="w-16 h-16 mx-auto mb-6 text-sage animate-spin" />
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                  {t("paymentSuccess.confirming")}
                </h1>
                <p className="text-muted-foreground">
                  {t("paymentSuccess.pleaseWait")}
                </p>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20">
          <section className="py-16 md:py-24">
            <div className="container mx-auto px-4">
              <div className="max-w-lg mx-auto text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                </div>
                <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                  {t("paymentSuccess.verificationIssue")}
                </h1>
                <p className="text-lg text-muted-foreground mb-8">
                  {verificationError}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="sage" asChild>
                    <Link to="/">{t("paymentSuccess.backHome")}</Link>
                  </Button>
                  <Button variant="luxuryOutline" asChild>
                    <Link to="/contact">{t("paymentSuccess.contactSupport")}</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-lg mx-auto text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sage-light flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-sage" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t("paymentSuccess.confirmed")}
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                {t("paymentSuccess.thankYou")}
              </p>
              <div className="bg-card rounded-2xl p-6 shadow-card mb-8 text-left">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                  {t("paymentSuccess.whatsNext")}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-sage mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{t("paymentSuccess.checkEmail")}</p>
                      <p className="text-sm text-muted-foreground">{t("paymentSuccess.checkEmailDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-sage mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{t("paymentSuccess.arriveOnTime")}</p>
                      <p className="text-sm text-muted-foreground">{t("paymentSuccess.arriveOnTimeDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-sage mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">{t("paymentSuccess.relaxEnjoy")}</p>
                      <p className="text-sm text-muted-foreground">{t("paymentSuccess.relaxEnjoyDesc")}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 mb-8 text-left border border-border">
                <p className="text-sm font-medium text-foreground mb-1">{t("paymentSuccess.privacyNotice")}</p>
                <p className="text-sm text-muted-foreground">{t("paymentSuccess.privacyNoticeDesc")}</p>
              </div>
              {bookingId && cancellationToken && (
                <div className="mb-8">
                  <BookingQRCard bookingId={bookingId} token={cancellationToken} />
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="sage" asChild>
                  <Link to="/">{t("paymentSuccess.backHome")}</Link>
                </Button>
                <Button variant="luxuryOutline" asChild>
                  <Link to="/cities">{t("paymentSuccess.bookAnother")}</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                {t("paymentSuccess.manageBookingPrompt")}{" "}
                <Link to="/manage-booking" className="text-primary hover:underline">
                  {t("paymentSuccess.manageBookingLink")}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentSuccess;