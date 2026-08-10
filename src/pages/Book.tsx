import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building, Hotel as HotelIcon, Home as HomeIcon, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";

const Book = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={t("book.seoTitle", "Jetzt buchen — Massavo")}
        description={t("book.seoDescription", "Wähle, ob du im Fitnessstudio oder im Hotel buchen möchtest.")}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            {t("book.title", "Wo möchtest du buchen?")}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            {t("book.subtitle", "Wähle einen Standort-Typ, um fortzufahren.")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Link
            to="/cities"
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-sage-light flex items-center justify-center text-primary">
                <Building className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
                  {t("book.gymTitle", "Im Fitnessstudio")}
                </h2>
                <p className="text-muted-foreground">
                  {t("book.gymDescription", "Buche deine Massage in einem unserer Partner-Fitnessstudios.")}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-primary font-medium mt-2 group-hover:gap-3 transition-all">
                {t("book.choose", "Auswählen")}
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>

          <Link
            to="/hotels"
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-sage-light flex items-center justify-center text-primary">
                <HotelIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
                  {t("book.hotelTitle", "Im Hotel")}
                </h2>
                <p className="text-muted-foreground">
                  {t("book.hotelDescription", "Buche deine Massage in einem unserer Partner-Hotels.")}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-primary font-medium mt-2 group-hover:gap-3 transition-all">
                {t("book.choose", "Auswählen")}
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>

          <Link
            to="/home-visit"
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex flex-col items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-sage-light flex items-center justify-center text-primary">
                <HomeIcon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
                  {t("book.homeTitle", "Als Hausbesuch")}
                </h2>
                <p className="text-muted-foreground">
                  {t("book.homeDescription", "Buche deine Massage bequem bei dir zu Hause.")}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-primary font-medium mt-2 group-hover:gap-3 transition-all">
                {t("book.choose", "Auswählen")}
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Book;