import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { useTranslation } from "react-i18next";

const Impressum = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Impressum – MASSAVO"
        description="Impressum gemäß § 5 TMG für MASSAVO – Anbieterkennzeichnung, Kontakt und rechtliche Informationen."
        path="/impressum"
        noindex
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
          {t("impressum.title")}
        </h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.companyInfoTitle")}</h2>
            <p className="text-muted-foreground">
              MASSAVO<br />
              Bracknellstraße 41<br />
              51379 Leverkusen<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.contactTitle")}</h2>
            <p className="text-muted-foreground">
              {t("contact.info.email")}:{" "}
              <a href="mailto:info@massavo.com" className="text-primary hover:underline">info@massavo.com</a>
              <br />
              Telefon: <a href="tel:+4916056521540" className="text-primary hover:underline">+49 160 5652154</a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Vertretungsberechtigte/r Inhaber/in</h2>
            <p className="text-muted-foreground">
              [Vollständiger Name des Inhabers / Geschäftsführers]
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Umsatzsteuer-ID / Steuernummer</h2>
            <p className="text-muted-foreground">
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG:<br />
              [DE XXXXXXXXX]<br />
              <br />
              Steuernummer: [XXX/XXXX/XXXX]
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Hinweis: Bitte trage hier die offiziellen Registerangaben ein, sobald sie vorliegen (z. B. HRB-Nummer, Amtsgericht).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.responsibleTitle")}</h2>
            <p className="text-muted-foreground">
              Verantwortlich gemäß § 18 Abs. 2 MStV:<br />
              [Vollständiger Name des Inhabers]<br />
              Bracknellstraße 41<br />
              51379 Leverkusen
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.disputeTitle")}</h2>
            <p className="text-muted-foreground">
              {t("impressum.disputeText")}{" "}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                https://ec.europa.eu/consumers/odr/
              </a>
              <br />
              {t("impressum.disputeEmailNote")}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.consumerDisputeTitle")}</h2>
            <p className="text-muted-foreground">{t("impressum.consumerDisputeText")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.contentLiabilityTitle")}</h2>
            <p className="text-muted-foreground">{t("impressum.contentLiabilityP1")}</p>
            <p className="text-muted-foreground mt-4">{t("impressum.contentLiabilityP2")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.linkLiabilityTitle")}</h2>
            <p className="text-muted-foreground">{t("impressum.linkLiabilityP1")}</p>
            <p className="text-muted-foreground mt-4">{t("impressum.linkLiabilityP2")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("impressum.copyrightTitle")}</h2>
            <p className="text-muted-foreground">{t("impressum.copyrightP1")}</p>
            <p className="text-muted-foreground mt-4">{t("impressum.copyrightP2")}</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Impressum;
