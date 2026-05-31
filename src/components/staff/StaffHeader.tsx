import { ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import massavoLogo from "@/assets/massavo-logo-3d.png";

interface StaffHeaderProps {
  isConnected: boolean;
  onSignOut: () => void;
  userEmail?: string;
  breadcrumb?: string;
  onBack?: () => void;
}

export function StaffHeader({ isConnected, onSignOut, userEmail, breadcrumb, onBack }: StaffHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {onBack ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : (
          <img src={massavoLogo} alt="MASSAVO" className="w-8 h-8 shrink-0" />
        )}
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-base font-bold text-foreground truncate">
            {breadcrumb || t("staff.header.portal")}
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs font-medium shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-destructive"
              }`}
            />
            <span className={isConnected ? "text-emerald-600" : "text-destructive"}>
              {isConnected ? t("staff.header.live") : t("staff.header.offline")}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <LanguageSwitcher variant="minimal" />
        {userEmail && (
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[140px]">
            {userEmail}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          <LogOut className="w-4 h-4 mr-1" />
          {t("staff.header.signOut")}
        </Button>
      </div>
    </header>
  );
}
