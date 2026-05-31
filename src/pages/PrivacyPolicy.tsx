import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { useTranslation } from "react-i18next";

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title="Datenschutzerklärung – MASSAVO"
        description="Wie wir deine Daten gemäß DSGVO bei MASSAVO verarbeiten: Erhebung, Nutzung, Weitergabe, Cookies und deine Rechte (Art. 15-17 DSGVO)."
        path="/privacy-policy"
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
          {t("privacyPolicy.title")}
        </h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground">{t("privacyPolicy.lastUpdated")}</p>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s1Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s1Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s2Title")}</h2>
            <h3 className="text-xl font-medium text-foreground mb-2">{t("privacyPolicy.s2PersonalTitle")}</h3>
            <p className="text-muted-foreground mb-4">{t("privacyPolicy.s2PersonalDesc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("privacyPolicy.s2Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            <h3 className="text-xl font-medium text-foreground mb-2 mt-6">{t("privacyPolicy.s2PaymentTitle")}</h3>
            <p className="text-muted-foreground">{t("privacyPolicy.s2PaymentDesc")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s3Title")}</h2>
            <p className="text-muted-foreground mb-4">{t("privacyPolicy.s3Desc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("privacyPolicy.s3Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s4Title")}</h2>
            <p className="text-muted-foreground">
              {t("privacyPolicy.s4Text")}{" "}
              <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">stripe.com/privacy</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s5Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s5Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s6Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s6Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s7Title")}</h2>
            <p className="text-muted-foreground mb-4">{t("privacyPolicy.s7Desc")}</p>
            <ul className="list-disc ps-6 text-muted-foreground space-y-2">
              {(t("privacyPolicy.s7Items", { returnObjects: true }) as string[]).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s8Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s8Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s9Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s9Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s10Title")}</h2>
            <p className="text-muted-foreground">{t("privacyPolicy.s10Text")}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">{t("privacyPolicy.s11Title")}</h2>
            <p className="text-muted-foreground">
              {t("privacyPolicy.s11Text")}{" "}
              <a href="mailto:info@massavo.com" className="text-primary hover:underline">info@massavo.com</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
