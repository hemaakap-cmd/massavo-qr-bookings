import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SEO from "@/components/SEO";
import { useTranslation } from "react-i18next";
import { Cookie, Shield, BarChart3, Settings } from "lucide-react";

type Lang = "de" | "en" | "fr" | "es" | "nl";

const CONTENT: Record<Lang, {
  title: string;
  subtitle: string;
  intro: string;
  whatTitle: string;
  whatBody: string;
  typesTitle: string;
  necessary: { name: string; purpose: string; duration: string };
  preferences: { name: string; purpose: string; duration: string };
  analytics: { name: string; purpose: string; duration: string };
  thirdPartyTitle: string;
  thirdPartyBody: string;
  manageTitle: string;
  manageBody: string;
  contactTitle: string;
  contactBody: string;
  cols: { name: string; purpose: string; duration: string };
  resetBtn: string;
}> = {
  de: {
    title: "Cookie-Richtlinie",
    subtitle: "Wie wir Cookies bei MASSAVO einsetzen",
    intro: "Diese Richtlinie erklärt transparent, welche Cookies und ähnlichen Technologien wir verwenden, zu welchem Zweck und wie lange sie gespeichert bleiben – im Einklang mit DSGVO und § 25 TTDSG.",
    whatTitle: "Was sind Cookies?",
    whatBody: "Cookies sind kleine Textdateien, die dein Browser auf deinem Gerät speichert, wenn du eine Website besuchst. Sie ermöglichen Funktionen wie Anmeldung, Sprachwahl und Sicherheitsprüfungen.",
    typesTitle: "Welche Cookies wir verwenden",
    necessary: {
      name: "massavo_cookie_consent_v1",
      purpose: "Speichert deine Cookie-Entscheidung (Akzeptieren/Ablehnen), damit der Banner nicht erneut erscheint.",
      duration: "12 Monate",
    },
    preferences: {
      name: "i18nextLng / massavo_country",
      purpose: "Speichert deine bevorzugte Sprache und dein Land, damit Inhalte korrekt dargestellt werden.",
      duration: "Dauerhaft (bis zur Löschung)",
    },
    analytics: {
      name: "supabase-auth-token",
      purpose: "Sicherheits-Token für angemeldete Benutzer (Therapeuten/Admin). Wird nur nach Login gesetzt.",
      duration: "Sitzungs- bzw. Tokendauer",
    },
    thirdPartyTitle: "Drittanbieter",
    thirdPartyBody: "Wir setzen KEINE Tracking-, Werbe- oder Social-Media-Cookies ein. Beim Bezahlen wirst du an Stripe weitergeleitet, wo deren eigene Cookie-Richtlinie gilt (stripe.com/privacy).",
    manageTitle: "Cookies verwalten",
    manageBody: "Du kannst deine Entscheidung jederzeit zurücksetzen. Klick dazu auf den Button unten – beim nächsten Seitenaufruf erscheint der Cookie-Banner erneut.",
    contactTitle: "Kontakt",
    contactBody: "Bei Fragen zum Datenschutz: info@massavo.com",
    cols: { name: "Name", purpose: "Zweck", duration: "Speicherdauer" },
    resetBtn: "Cookie-Einstellungen zurücksetzen",
  },
  en: {
    title: "Cookie Policy",
    subtitle: "How MASSAVO uses cookies",
    intro: "This policy transparently explains which cookies and similar technologies we use, for what purpose, and how long they are stored — in line with GDPR and § 25 TTDSG.",
    whatTitle: "What are cookies?",
    whatBody: "Cookies are small text files stored on your device by your browser when you visit a website. They enable features like login, language selection and security checks.",
    typesTitle: "Which cookies we use",
    necessary: {
      name: "massavo_cookie_consent_v1",
      purpose: "Stores your cookie decision (Accept/Reject) so the banner is not shown again.",
      duration: "12 months",
    },
    preferences: {
      name: "i18nextLng / massavo_country",
      purpose: "Stores your preferred language and country to render content correctly.",
      duration: "Persistent (until cleared)",
    },
    analytics: {
      name: "supabase-auth-token",
      purpose: "Security token for logged-in users (therapists/admin). Only set after login.",
      duration: "Session / token lifetime",
    },
    thirdPartyTitle: "Third parties",
    thirdPartyBody: "We do NOT use tracking, advertising or social-media cookies. During checkout you are redirected to Stripe, where Stripe's own cookie policy applies (stripe.com/privacy).",
    manageTitle: "Manage cookies",
    manageBody: "You can reset your choice anytime. Click the button below — the consent banner will reappear on your next visit.",
    contactTitle: "Contact",
    contactBody: "Privacy questions: info@massavo.com",
    cols: { name: "Name", purpose: "Purpose", duration: "Storage duration" },
    resetBtn: "Reset cookie preferences",
  },
  fr: {
    title: "Politique de cookies",
    subtitle: "Comment MASSAVO utilise les cookies",
    intro: "Cette politique explique de manière transparente les cookies et technologies similaires que nous utilisons, leur finalité et leur durée de conservation, conformément au RGPD.",
    whatTitle: "Qu'est-ce qu'un cookie ?",
    whatBody: "Les cookies sont de petits fichiers texte enregistrés par votre navigateur lors de votre visite. Ils permettent la connexion, le choix de la langue et les contrôles de sécurité.",
    typesTitle: "Cookies utilisés",
    necessary: {
      name: "massavo_cookie_consent_v1",
      purpose: "Mémorise votre choix (Accepter/Refuser) pour ne plus afficher la bannière.",
      duration: "12 mois",
    },
    preferences: {
      name: "i18nextLng / massavo_country",
      purpose: "Mémorise votre langue et pays préférés pour afficher le contenu adapté.",
      duration: "Persistant (jusqu'à suppression)",
    },
    analytics: {
      name: "supabase-auth-token",
      purpose: "Jeton de sécurité pour les utilisateurs connectés (thérapeutes/admin). Défini après connexion.",
      duration: "Session / durée du jeton",
    },
    thirdPartyTitle: "Tiers",
    thirdPartyBody: "Nous n'utilisons AUCUN cookie de suivi, publicitaire ou réseau social. Lors du paiement, vous êtes redirigé vers Stripe (stripe.com/privacy).",
    manageTitle: "Gérer les cookies",
    manageBody: "Vous pouvez réinitialiser votre choix à tout moment. Cliquez sur le bouton ci-dessous, la bannière réapparaîtra.",
    contactTitle: "Contact",
    contactBody: "Questions sur la confidentialité : info@massavo.com",
    cols: { name: "Nom", purpose: "Finalité", duration: "Durée" },
    resetBtn: "Réinitialiser les préférences",
  },
  es: {
    title: "Política de cookies",
    subtitle: "Cómo MASSAVO utiliza las cookies",
    intro: "Esta política explica con transparencia qué cookies y tecnologías similares utilizamos, con qué finalidad y durante cuánto tiempo, conforme al RGPD.",
    whatTitle: "¿Qué son las cookies?",
    whatBody: "Pequeños archivos de texto que tu navegador guarda en tu dispositivo. Permiten funciones como inicio de sesión, idioma y comprobaciones de seguridad.",
    typesTitle: "Cookies que usamos",
    necessary: {
      name: "massavo_cookie_consent_v1",
      purpose: "Guarda tu decisión (Aceptar/Rechazar) para no mostrar el banner de nuevo.",
      duration: "12 meses",
    },
    preferences: {
      name: "i18nextLng / massavo_country",
      purpose: "Guarda tu idioma y país preferidos.",
      duration: "Persistente (hasta borrar)",
    },
    analytics: {
      name: "supabase-auth-token",
      purpose: "Token de seguridad para usuarios autenticados (terapeutas/admin). Solo tras iniciar sesión.",
      duration: "Sesión / duración del token",
    },
    thirdPartyTitle: "Terceros",
    thirdPartyBody: "NO usamos cookies de seguimiento, publicidad o redes sociales. Al pagar serás redirigido a Stripe (stripe.com/privacy).",
    manageTitle: "Gestionar cookies",
    manageBody: "Puedes restablecer tu elección en cualquier momento. Pulsa el botón y el banner reaparecerá.",
    contactTitle: "Contacto",
    contactBody: "Consultas de privacidad: info@massavo.com",
    cols: { name: "Nombre", purpose: "Finalidad", duration: "Duración" },
    resetBtn: "Restablecer preferencias",
  },
  nl: {
    title: "Cookiebeleid",
    subtitle: "Hoe MASSAVO cookies gebruikt",
    intro: "Dit beleid legt transparant uit welke cookies en vergelijkbare technologieën wij gebruiken, voor welk doel en hoe lang, conform de AVG.",
    whatTitle: "Wat zijn cookies?",
    whatBody: "Cookies zijn kleine tekstbestanden die je browser opslaat bij een websitebezoek. Ze maken inloggen, taalkeuze en beveiligingscontroles mogelijk.",
    typesTitle: "Welke cookies gebruiken wij",
    necessary: {
      name: "massavo_cookie_consent_v1",
      purpose: "Slaat je keuze op (Accepteren/Weigeren) zodat de banner niet opnieuw verschijnt.",
      duration: "12 maanden",
    },
    preferences: {
      name: "i18nextLng / massavo_country",
      purpose: "Slaat je voorkeurstaal en -land op.",
      duration: "Permanent (tot verwijderen)",
    },
    analytics: {
      name: "supabase-auth-token",
      purpose: "Beveiligingstoken voor ingelogde gebruikers (therapeuten/admin). Alleen na inloggen.",
      duration: "Sessie / tokenduur",
    },
    thirdPartyTitle: "Derden",
    thirdPartyBody: "Wij gebruiken GEEN tracking-, advertentie- of social-mediacookies. Bij betalen word je doorgeleid naar Stripe (stripe.com/privacy).",
    manageTitle: "Cookies beheren",
    manageBody: "Je kunt je keuze altijd resetten. Klik op de knop hieronder en de banner verschijnt weer.",
    contactTitle: "Contact",
    contactBody: "Privacyvragen: info@massavo.com",
    cols: { name: "Naam", purpose: "Doel", duration: "Bewaartermijn" },
    resetBtn: "Cookievoorkeuren resetten",
  },
};

const CookiePolicy = () => {
  const { i18n } = useTranslation();
  const lang = ((i18n.language || "de").split("-")[0] as Lang);
  const c = CONTENT[lang] || CONTENT.de;

  const resetConsent = () => {
    try {
      localStorage.removeItem("massavo_cookie_consent_v1");
      window.location.reload();
    } catch {
      // Storage can be unavailable (Safari private mode); nothing to reset then.
    }
  };

  const Row = ({ icon: Icon, category, item }: { icon: typeof Shield; category: string; item: { name: string; purpose: string; duration: string } }) => (
    <div className="bg-card rounded-xl p-5 shadow-card">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-foreground">{category}</h3>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{c.cols.name}</dt>
          <dd className="text-foreground font-mono break-all">{item.name}</dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{c.cols.duration}</dt>
          <dd className="text-foreground">{item.duration}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{c.cols.purpose}</dt>
          <dd className="text-foreground">{item.purpose}</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <SEO
        title={`${c.title} – MASSAVO`}
        description={c.intro.slice(0, 155)}
        path="/cookie-policy"
      />
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Cookie className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">{c.title}</h1>
              <p className="text-sm text-muted-foreground">{c.subtitle}</p>
            </div>
          </div>

          <p className="text-foreground/90 leading-relaxed my-8">{c.intro}</p>

          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">{c.whatTitle}</h2>
            <p className="text-muted-foreground leading-relaxed">{c.whatBody}</p>
          </section>

          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-4">{c.typesTitle}</h2>
            <div className="space-y-4">
              <Row icon={Shield} category="Strictly Necessary" item={c.necessary} />
              <Row icon={Settings} category="Preferences" item={c.preferences} />
              <Row icon={BarChart3} category="Authentication" item={c.analytics} />
            </div>
          </section>

          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">{c.thirdPartyTitle}</h2>
            <p className="text-muted-foreground leading-relaxed">{c.thirdPartyBody}</p>
          </section>

          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold text-foreground mb-3">{c.manageTitle}</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">{c.manageBody}</p>
            <button
              onClick={resetConsent}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Cookie className="w-4 h-4" />
              {c.resetBtn}
            </button>
          </section>

          <section className="bg-muted/50 rounded-lg p-4 border border-border text-sm text-muted-foreground">
            <strong className="text-foreground">{c.contactTitle}:</strong>{" "}
            <a href="mailto:info@massavo.com" className="text-primary underline">{c.contactBody}</a>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CookiePolicy;