import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { useTranslation } from "react-i18next";

const TermsOfService = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Nutzungsbedingungen – MASSAVO"
        description="Allgemeine Geschäftsbedingungen (AGB) und Nutzungsbedingungen für die Buchung von Massage-Dienstleistungen über MASSAVO."
        path="/terms-of-service"
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
          {t("termsOfService.title")}
        </h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground">{t("termsOfService.lastUpdated")}</p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s1Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s1Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s2Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s2Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s3Title")}</h2>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("termsOfService.s3Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s4Title")}</h2>
            <p className="text-muted-foreground mb-4">{t("termsOfService.s4Desc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("termsOfService.s4Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s5Title")}</h2>
            <p className="text-muted-foreground mb-4">{t("termsOfService.s5Desc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("termsOfService.s5Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s6Title")}</h2>
            <p className="text-muted-foreground mb-4">{t("termsOfService.s6Desc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("termsOfService.s6Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s7Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s7Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s8Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s8Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s9Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s9Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s10Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s10Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s11Title")}</h2>
            <p className="text-muted-foreground">{t("termsOfService.s11Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("termsOfService.s12Title")}</h2>
            <p className="text-muted-foreground">
              {t("termsOfService.s12Text")}{" "}
              <a href="mailto:info@massavo.com" className="text-primary hover:underline">info@massavo.com</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
