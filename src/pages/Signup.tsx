import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import PasswordStrengthIndicator from "@/components/auth/PasswordStrengthIndicator";
import { checkPasswordStrength, getPasswordErrors } from "@/lib/passwordValidation";
import { useTranslation } from "react-i18next";

const Signup = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { score } = checkPasswordStrength(password);
  const isPasswordValid = score === 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password strength before submission
    if (!isPasswordValid) {
      const errors = getPasswordErrors(password);
      toast({
        title: t("auth.passwordRequirementsNotMet"),
        description: t("auth.passwordMissing", { items: errors.join(", ") }),
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast({
        title: t("auth.signupFailed"),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t("auth.accountCreated"),
        description: t("auth.accountCreatedDesc"),
      });
      navigate("/login");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto">
              <div className="bg-card rounded-2xl p-8 shadow-card">
                <h1 className="font-display text-2xl font-bold text-foreground text-center mb-6">
                  {t("auth.signupTitle")}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t("auth.fullName")}</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("auth.emailPlaceholder")}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t("auth.password")}</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={10}
                    />
                    <PasswordStrengthIndicator password={password} />
                  </div>

                  <Button
                    type="submit"
                    variant="sage"
                    className="w-full"
                    disabled={isLoading || !isPasswordValid}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("auth.creatingAccount")}
                      </>
                    ) : (
                      t("auth.signUp")
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  {t("auth.hasAccount")}{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    {t("auth.signIn")}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Signup;
