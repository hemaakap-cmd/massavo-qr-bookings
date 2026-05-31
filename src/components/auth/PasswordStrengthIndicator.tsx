import { Check, X } from "lucide-react";
import { checkPasswordStrength } from "@/lib/passwordValidation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const { t } = useTranslation();
  const { score, requirements } = checkPasswordStrength(password);

  if (!password) return null;

  const getStrengthColor = () => {
    if (score <= 2) return "bg-destructive";
    if (score <= 3) return "bg-orange-500";
    if (score <= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthText = () => {
    if (score <= 2) return t("passwordStrength.weak");
    if (score <= 3) return t("passwordStrength.fair");
    if (score <= 4) return t("passwordStrength.good");
    return t("passwordStrength.strong");
  };

  const requirementsList = [
    { key: "minLength", label: t("passwordStrength.minLength"), met: requirements.minLength },
    { key: "hasUppercase", label: t("passwordStrength.uppercase"), met: requirements.hasUppercase },
    { key: "hasLowercase", label: t("passwordStrength.lowercase"), met: requirements.hasLowercase },
    { key: "hasNumber", label: t("passwordStrength.number"), met: requirements.hasNumber },
    { key: "hasSymbol", label: t("passwordStrength.symbol"), met: requirements.hasSymbol },
  ];

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{t("passwordStrength.label")}</span>
          <span className={cn(
            "font-medium",
            score === 5 ? "text-primary" : "text-muted-foreground"
          )}>
            {getStrengthText()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${(score / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <ul className="space-y-1 text-xs">
        {requirementsList.map(({ key, label, met }) => (
          <li
            key={key}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              met ? "text-primary" : "text-muted-foreground"
            )}
          >
            {met ? (
              <Check className="w-3 h-3" />
            ) : (
              <X className="w-3 h-3" />
            )}
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
