import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "massavo_cookie_consent_v1";

type Choice = "accepted" | "rejected";

const COPY: Record<string, { title: string; body: string; accept: string; reject: string; learn: string }> = {
  de: {
    title: "Wir respektieren deine Privatsphäre",
    body: "Wir verwenden ausschließlich technisch notwendige Cookies, um dir die Buchung und Anmeldung zu ermöglichen. Es werden keine Tracking- oder Werbe-Cookies gesetzt.",
    accept: "Akzeptieren",
    reject: "Ablehnen",
    learn: "Mehr erfahren",
  },
  en: {
    title: "We respect your privacy",
    body: "We only use strictly necessary cookies to enable bookings and login. No tracking or advertising cookies are used.",
    accept: "Accept",
    reject: "Reject",
    learn: "Learn more",
  },
  fr: {
    title: "Nous respectons votre vie privée",
    body: "Nous utilisons uniquement des cookies strictement nécessaires pour permettre les réservations et la connexion. Aucun cookie de suivi ou publicitaire.",
    accept: "Accepter",
    reject: "Refuser",
    learn: "En savoir plus",
  },
  es: {
    title: "Respetamos tu privacidad",
    body: "Solo usamos cookies estrictamente necesarias para reservas e inicio de sesión. No se utilizan cookies de seguimiento ni publicidad.",
    accept: "Aceptar",
    reject: "Rechazar",
    learn: "Más información",
  },
  nl: {
    title: "Wij respecteren je privacy",
    body: "We gebruiken alleen strikt noodzakelijke cookies voor boekingen en inloggen. Geen tracking- of advertentiecookies.",
    accept: "Accepteren",
    reject: "Weigeren",
    learn: "Meer info",
  },
};

export const CookieConsent = () => {
  const { i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (choice: Choice) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() })
      );
    } catch {
      // Storage can be unavailable (Safari private mode, blocked cookies).
      // The choice is then not persisted, but the banner still dismisses.
    }
    setVisible(false);
  };

  if (!visible) return null;

  const lang = (i18n.language || "de").split("-")[0];
  const c = COPY[lang] || COPY.de;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={c.title}
      className="fixed inset-x-0 bottom-0 z-[1000] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-elegant p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary/10 items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground mb-1">
              {c.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {c.body}{" "}
              <Link to="/privacy-policy" className="text-primary underline underline-offset-2">
                {c.learn}
              </Link>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => decide("rejected")}>
                {c.reject}
              </Button>
              <Button size="sm" onClick={() => decide("accepted")}>
                {c.accept}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;