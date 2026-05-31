import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Mail } from "lucide-react";
import massavoLogo from "@/assets/massavo-logo-3d.png";
import type { AppRole } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

interface OTPLoginPageProps {
  title: string;
  subtitle: string;
  allowedRoles: AppRole[];
  verifyPath: string;
  icon?: React.ReactNode;
}

export default function OTPLoginPage({
  title,
  subtitle,
  allowedRoles,
  verifyPath,
  icon,
}: OTPLoginPageProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email: email.trim(), allowedRoles }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        toast({
          title: t("auth.error"),
          description: data.error || t("auth.sendCodeFailed"),
          variant: "destructive",
        });
      } else {
        toast({
          title: t("auth.codeSent"),
          description: t("auth.checkEmailCode"),
        });
        navigate(verifyPath, { state: { email: email.trim(), allowedRoles } });
      }
    } catch {
      toast({
        title: t("auth.error"),
        description: t("auth.networkError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={massavoLogo} alt="MASSAVO" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-2">{subtitle}</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
          <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-primary/5 border border-primary/10">
            {icon || <Shield className="w-5 h-5 text-primary flex-shrink-0" />}
            <p className="text-sm text-muted-foreground">
              {t("auth.passwordlessInfo")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.emailAddress")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="sage"
              className="w-full"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("auth.sendingCode")}
                </>
              ) : (
                t("auth.sendVerificationCode")
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
