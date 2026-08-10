import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Languages } from "lucide-react";
import { languages, LanguageCode } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface LanguageSwitcherProps {
  variant?: "default" | "minimal";
}

const LanguageSwitcher = forwardRef<HTMLDivElement, LanguageSwitcherProps>(
  ({ variant = "default" }, ref) => {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);

    const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

    const handleLanguageChange = (code: LanguageCode) => {
      i18n.changeLanguage(code);
      // Storage can be unavailable (Safari private mode); the language still
      // changes for this session, it just is not remembered.
      try { localStorage.setItem("i18nextLng", code); } catch { /* ignore */ }
      setOpen(false);
    };

    return (
      <div ref={ref} aria-label="Language switcher">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label="Change language">
              <Languages className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">{currentLang.code}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            {languages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`gap-2 cursor-pointer ${
                  lang.code === currentLang.code ? "bg-sage-light" : ""
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span className="text-xs font-semibold uppercase">{lang.code}</span>
                <span className="text-sm text-muted-foreground">{lang.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

LanguageSwitcher.displayName = "LanguageSwitcher";

export default LanguageSwitcher;
