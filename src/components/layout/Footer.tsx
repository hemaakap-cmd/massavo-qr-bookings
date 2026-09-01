import { forwardRef } from "react"; 
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Instagram } from "lucide-react";
import { useCountryServices } from "@/hooks/useCountryServices";
import i18n from "@/i18n";
import massavoFooterLogo from "@/assets/massavo-logo-footer.png";

const Footer = forwardRef<HTMLElement>((_, ref) => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();
  const { services } = useCountryServices();
  const isAr = i18n.language === "ar";
  // Unified with dashboard: real DB services, exclude test items (< €5)
  // Show only the service type (no durations) and remove duplicates
  const displayServices = Array.from(
    new Set(
      services
        .filter((s) => Number(s.price) >= 5)
        .map((s) => {
          const raw = isAr && s.name_ar ? s.name_ar : s.name;
          return raw
            .replace(/[–-]?\s*\d+\s*(min|Min|minutes|Minuten|دقيقة)\.?/gi, "")
            .replace(/\s*[–-]\s*$/, "")
            .trim();
        })
        .filter(Boolean),
    ),
  )
    .slice(0, 6)
    .map((label) => ({ label }));


  return (
    <footer ref={ref} className="bg-sage text-primary-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center">
              <img
                src={massavoFooterLogo}
                alt="MASSAVO – Premium Massage"
                className="h-14 w-auto"
              />
            </Link>
            <p className="text-cream/80 text-sm leading-relaxed">
              {t("footer.description")}
            </p>
            <div className="flex gap-4">
              <a href="https://www.instagram.com/massavo.gym" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-cream/10 hover:bg-cream/20 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">{t("footer.quickLinks")}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/cities" className="text-cream/80 hover:text-cream transition-colors text-sm">
                  {t("footer.findGym")}
                </Link>
              </li>
              <li>
                <Link to="/hotels" className="text-cream/80 hover:text-cream transition-colors text-sm">
                  {t("nav.hotels", "Hotels")}
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-cream/80 hover:text-cream transition-colors text-sm">
                  {t("nav.services")}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-cream/80 hover:text-cream transition-colors text-sm">
                  {t("footer.aboutUs")}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-cream/80 hover:text-cream transition-colors text-sm">
                  {t("footer.contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display text-lg font-semibold mb-4">{t("footer.services")}</h4>
            <ul className="space-y-3">
              {displayServices.length === 0 ? (
                <li><span className="text-cream/60 text-sm">—</span></li>
              ) : (
                displayServices.map((s) => (
                  <li key={s.label}>
                    <Link to="/services" className="text-cream/80 hover:text-cream transition-colors text-sm">
                      {s.label}
                    </Link>
                  </li>
                ))
              )}

            </ul>
          </div>

        </div>

        <div className="border-t border-cream/20 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-cream/60 text-sm">
            © {currentYear} MASSAVO. {t("footer.rights")}
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/privacy-policy" className="text-cream/60 hover:text-cream text-sm transition-colors">
              {t("footer.privacy")}
            </Link>
            <Link to="/terms-of-service" className="text-cream/60 hover:text-cream text-sm transition-colors">
              {t("footer.terms")}
            </Link>
            <Link to="/impressum" className="text-cream/60 hover:text-cream text-sm transition-colors">
              Impressum
            </Link>
            <Link to="/cookie-policy" className="text-cream/60 hover:text-cream text-sm transition-colors">
              Cookies
            </Link>
            <Link to="/contact" className="text-cream/60 hover:text-cream text-sm transition-colors">
              {t("nav_extra.customerSupport")}
            </Link>
            <Link to="/booking-policy" className="text-cream/60 hover:text-cream text-sm transition-colors">
              {t("nav_extra.bookingPolicy")}
            </Link>
          </div>
        </div>

        <div className="border-t border-cream/10 mt-6 pt-4">
          <div className="flex justify-center items-center gap-4 text-[11px] text-cream/40">
            <Link to="/staff/login" className="hover:text-cream/70 transition-colors">{t("nav_extra.staffPortal")}</Link>
            <span className="text-cream/20">·</span>
            <Link to="/admin/login" className="hover:text-cream/70 transition-colors">Admin</Link>
            <span className="text-cream/20">·</span>
            <Link to="/admin/login" className="hover:text-cream/70 transition-colors">Super Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
