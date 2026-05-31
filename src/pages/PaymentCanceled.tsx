import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

const PaymentCanceled = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-lg mx-auto text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                {t("paymentCanceled.title")}
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                {t("paymentCanceled.description")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="sage" asChild>
                  <Link to="/cities">{t("paymentCanceled.tryAgain")}</Link>
                </Button>
                <Button variant="luxuryOutline" asChild>
                  <Link to="/">{t("paymentCanceled.backHome")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PaymentCanceled;