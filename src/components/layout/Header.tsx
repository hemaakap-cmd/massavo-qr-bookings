import { useState, forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, MapPin, Settings, Calendar } from "lucide-react";
import massavoLogo from "@/assets/massavo-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useTodayPendingBookings } from "@/hooks/useTodayPendingBookings";
import { useToast } from "@/hooks/use-toast";
import LanguageSwitcher from "./LanguageSwitcher";
import { CountrySwitcherPublic } from "./CountrySwitcherPublic";

const Header = forwardRef<HTMLElement>((_, ref) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { data: pendingCount = 0 } = useTodayPendingBookings(isAdmin);
  // RTL no longer needed (German + English only)
  const isRTL = false;

  const handleSignOut = async () => {
    try {
      console.log("Starting sign out...");
      const { error } = await signOut();
      console.log("Sign out result:", { error });
      
      if (error) {
        console.error("Sign out error:", error);
        toast({
          title: t("header.signOutFailed"),
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Force a complete page reload to clear all state
        console.log("Sign out successful, reloading...");
        window.location.replace("/");
      }
    } catch (err) {
      console.error("Sign out exception:", err);
      toast({
        title: t("header.signOutFailed"),
        description: t("header.unexpectedError"),
        variant: "destructive",
      });
    }
  };

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/cities", label: t("nav.findGym") },
    { href: "/hotels", label: t("nav.findHotel") },
    { href: "/services", label: t("nav.services") },
    { href: "/manage-booking", label: t("nav.manageBooking", "Buchung verwalten") },
    { href: "/about", label: t("nav.about") },
    { href: "/contact", label: t("nav.contact") },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header ref={ref} className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src={massavoLogo} 
              alt="MASSAVO – Premium Massage" 
              className="h-10 lg:h-12 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className={`hidden lg:flex items-center ${isRTL ? "gap-3 xl:gap-5" : "gap-6 xl:gap-8"}`}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`font-medium transition-colors duration-200 whitespace-nowrap ${isRTL ? "text-sm" : ""} ${
                  isActive(link.href)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <CountrySwitcherPublic />
            <LanguageSwitcher variant="minimal" />
            {user && isAdmin && (
              <>
                <Button variant="ghost" size="sm" asChild className="relative">
                  <Link to="/admin/bookings">
                    <Calendar className="w-4 h-4 mr-1" />
                    {t("nav_extra.bookings")}
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">
                        {pendingCount}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin">
                    <Settings className="w-4 h-4 mr-1" />
                    {t("nav.admin")}
                  </Link>
                </Button>
              </>
            )}
            {user && (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                {t("nav.signOut")}
              </Button>
            )}
            <Button variant="sage" size="sm" asChild>
              <Link to="/book">
                <MapPin className="w-4 h-4 mr-1" />
                {t("nav.bookNow")}
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <CountrySwitcherPublic />
            <LanguageSwitcher variant="minimal" />
            <button
              className="p-2 rounded-lg hover:bg-secondary transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border animate-fade-in">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                    isActive(link.href)
                      ? "bg-sage-light text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                {user && isAdmin && (
                  <>
                    <Button variant="outline" asChild className="justify-center relative">
                      <Link to="/admin/bookings" onClick={() => setIsMenuOpen(false)}>
                        <Calendar className="w-4 h-4 mr-1" />
                        {t("nav_extra.bookings")}
                        {pendingCount > 0 && (
                          <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1 text-xs">
                            {pendingCount}
                          </Badge>
                        )}
                      </Link>
                    </Button>
                    <Button variant="outline" asChild className="justify-center">
                      <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                        <Settings className="w-4 h-4 mr-1" />
                        {t("nav.admin")}
                      </Link>
                    </Button>
                  </>
                )}
                {user && (
                  <Button variant="outline" onClick={() => { handleSignOut(); setIsMenuOpen(false); }} className="justify-center">
                    {t("nav.signOut")}
                  </Button>
                )}
                <Button variant="sage" asChild className="justify-center">
                  <Link to="/book" onClick={() => setIsMenuOpen(false)}>
                    <MapPin className="w-4 h-4 mr-1" />
                    {t("nav.bookNow")}
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
