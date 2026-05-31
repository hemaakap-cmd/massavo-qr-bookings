import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Home, Compass } from "lucide-react";
import { SEO } from "@/components/SEO";

const MESSAGES: Record<string, { title: string; subtitle: string; cta: string }> = {
  ar: { title: "الصفحة غير موجودة", subtitle: "عذراً، الصفحة التي تبحث عنها غير متاحة.", cta: "العودة للرئيسية" },
  de: { title: "Seite nicht gefunden", subtitle: "Die gesuchte Seite existiert leider nicht.", cta: "Zur Startseite" },
  en: { title: "Page not found", subtitle: "Sorry, the page you're looking for doesn't exist.", cta: "Back to Home" },
  fr: { title: "Page introuvable", subtitle: "Désolé, la page que vous cherchez n'existe pas.", cta: "Retour à l'accueil" },
  es: { title: "Página no encontrada", subtitle: "Lo sentimos, la página que buscas no existe.", cta: "Volver al inicio" },
  nl: { title: "Pagina niet gevonden", subtitle: "Sorry, de pagina die je zoekt bestaat niet.", cta: "Terug naar home" },
};

const NotFound = () => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = (i18n.language || "de").split("-")[0];
  const msg = MESSAGES[lang] || MESSAGES.de;

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SEO title={`404 — ${msg.title}`} description={msg.subtitle} path={location.pathname} noindex />
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
          <Compass className="w-10 h-10 text-primary" />
        </div>
        <h1 className="font-display text-6xl sm:text-7xl font-bold text-foreground mb-3">404</h1>
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">{msg.title}</h2>
        <p className="text-muted-foreground mb-8">{msg.subtitle}</p>
        <Button asChild size="lg">
          <Link to="/">
            <Home className="w-4 h-4" />
            {msg.cta}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
