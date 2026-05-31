import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { Shield, Clock, AlertTriangle, Droplets } from "lucide-react";
import { useTranslation } from "react-i18next";

const BookingPolicy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Buchungsrichtlinien & Widerrufsrecht – MASSAVO"
        description="Stornierungsregeln, Rückerstattungen, Handtuchpflicht und Widerrufsbelehrung gemäß § 312g BGB für Massagebuchungen bei MASSAVO."
        path="/booking-policy"
      />
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
            {t("bookingPolicy.title")}
          </h1>
          <p className="text-muted-foreground mb-10">
            {t("bookingPolicy.subtitle")}
          </p>

          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t("bookingPolicy.cancellationRule")}
              </h2>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-card space-y-3">
              <p className="text-foreground" dangerouslySetInnerHTML={{ __html: t("bookingPolicy.cancellationDesc").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              <p className="text-muted-foreground text-sm">
                {t("bookingPolicy.cancellationHint")}
              </p>
            </div>
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t("bookingPolicy.refundTitle")}
              </h2>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-card space-y-3">
              <ul className="list-disc list-inside space-y-2 text-foreground">
                <li><strong>{t("bookingPolicy.refund24")}</strong> {t("bookingPolicy.refund24Desc")}</li>
                <li><strong>{t("bookingPolicy.refundLate")}</strong> {t("bookingPolicy.refundLateDesc")}</li>
                <li><strong>{t("bookingPolicy.noShow")}</strong> {t("bookingPolicy.noShowDesc")}</li>
              </ul>
              <p className="text-muted-foreground text-sm mt-4">
                {t("bookingPolicy.refundException")}{" "}
                <a href="mailto:info@massavo.com" className="text-primary underline">info@massavo.com</a>.
              </p>
            </div>
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-sage" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t("bookingPolicy.towelTitle")}
              </h2>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-card">
              <p className="text-foreground" dangerouslySetInnerHTML={{ __html: t("bookingPolicy.towelDesc").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          </section>

          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t("bookingPolicy.generalTitle")}
              </h2>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-card space-y-3">
              <ul className="list-disc list-inside space-y-2 text-foreground">
                <li dangerouslySetInnerHTML={{ __html: t("bookingPolicy.general1").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                <li>{t("bookingPolicy.general2")}</li>
                <li>{t("bookingPolicy.general3")}</li>
              </ul>
            </div>
          </section>

          {/* Widerrufsbelehrung – §312g BGB / §356 BGB */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Widerrufsrecht & Erlöschen des Widerrufsrechts
              </h2>
            </div>
            <div className="bg-card rounded-xl p-6 shadow-card space-y-4 text-foreground text-sm leading-relaxed">
              <p>
                <strong>Widerrufsrecht:</strong> Du hast das Recht, binnen 14 Tagen ohne
                Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist
                beträgt 14 Tage ab dem Tag des Vertragsabschlusses.
              </p>
              <p>
                Um dein Widerrufsrecht auszuüben, musst du uns (MASSAVO,
                Bracknellstraße 41, 51379 Leverkusen, E-Mail:{" "}
                <a href="mailto:info@massavo.com" className="text-primary underline">
                  info@massavo.com
                </a>
                ) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter
                Brief oder eine E-Mail) über deinen Entschluss informieren.
              </p>
              <p>
                <strong>Vorzeitiges Erlöschen des Widerrufsrechts (§ 356 Abs. 4 BGB):</strong>{" "}
                Bei Dienstleistungen erlischt das Widerrufsrecht, wenn wir die
                Dienstleistung vollständig erbracht haben und mit der Ausführung der
                Dienstleistung erst begonnen haben, nachdem du dazu deine ausdrückliche
                Zustimmung gegeben hast und gleichzeitig deine Kenntnis davon bestätigt
                hast, dass du dein Widerrufsrecht bei vollständiger Vertragserfüllung
                durch uns verlierst.
              </p>
              <p className="text-muted-foreground">
                Mit Abschluss der Buchung und Akzeptanz dieser Richtlinien stimmst du
                ausdrücklich zu, dass die Massage-Dienstleistung zum gewählten Termin
                erbracht wird, und bestätigst, dass dein Widerrufsrecht mit
                vollständiger Leistungserbringung erlischt.
              </p>
            </div>
          </section>

          <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm text-muted-foreground">
            {t("bookingPolicy.contactNote")}{" "}
            <a href="mailto:info@massavo.com" className="text-primary underline">info@massavo.com</a>.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BookingPolicy;
