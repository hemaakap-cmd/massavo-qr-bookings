import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BotProtectionProps {
  onVerified: (verified: boolean, token: string) => void;
  formLoadTime: number;
}

// Generate a simple math problem
const generateMathProblem = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operators = ["+", "-"] as const;
  const operator = operators[Math.floor(Math.random() * operators.length)];
  
  let answer: number;
  let question: string;
  
  if (operator === "+") {
    answer = num1 + num2;
    question = `${num1} + ${num2}`;
  } else {
    // Ensure positive result
    const larger = Math.max(num1, num2);
    const smaller = Math.min(num1, num2);
    answer = larger - smaller;
    question = `${larger} - ${smaller}`;
  }
  
  return { question, answer };
};

// Create a verification token
const createVerificationToken = (formLoadTime: number, answer: number): string => {
  const timeDiff = Date.now() - formLoadTime;
  const payload = {
    t: formLoadTime,
    d: timeDiff,
    a: answer,
    v: Date.now(),
  };
  return btoa(JSON.stringify(payload));
};

const BotProtection = ({ onVerified, formLoadTime }: BotProtectionProps) => {
  const { t } = useTranslation();
  const [userAnswer, setUserAnswer] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [honeypot, setHoneypot] = useState(""); // Hidden field that bots fill

  // Generate math problem once on mount
  const mathProblem = useMemo(() => generateMathProblem(), []);
  
  // Minimum time (in ms) a human would take to fill the form
  const MIN_FORM_TIME_MS = 3000; // 3 seconds

  useEffect(() => {
    // Check if honeypot is filled (bot detected)
    if (honeypot) {
      console.warn("Bot detected via honeypot");
      onVerified(false, "");
      return;
    }

    // Validate answer
    const numAnswer = parseInt(userAnswer, 10);
    if (!isNaN(numAnswer) && numAnswer === mathProblem.answer) {
      const timeDiff = Date.now() - formLoadTime;
      
      // Check if form was filled too fast (bot behavior)
      if (timeDiff < MIN_FORM_TIME_MS) {
        console.warn("Form submitted too quickly, possible bot");
        setAttempts(prev => prev + 1);
        setUserAnswer("");
        onVerified(false, "");
        return;
      }
      
      setIsVerified(true);
      const token = createVerificationToken(formLoadTime, numAnswer);
      onVerified(true, token);
    } else if (userAnswer.length > 0 && userAnswer.length >= String(mathProblem.answer).length) {
      // Wrong answer with enough digits
      if (!isNaN(numAnswer)) {
        setAttempts(prev => prev + 1);
      }
      setIsVerified(false);
      onVerified(false, "");
    }
  }, [userAnswer, honeypot, mathProblem.answer, formLoadTime, onVerified]);

  return (
    <div className="space-y-4 mt-6 p-4 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {isVerified ? (
          <CheckCircle2 className="w-4 h-4 text-primary" />
        ) : (
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
        )}
        <span>{t("botProtection.title")}</span>
      </div>
      
      {/* Honeypot field - hidden from users but visible to bots */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="captcha" className="text-sm text-muted-foreground">
          {t("botProtection.question", { problem: mathProblem.question })}
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="captcha"
            type="number"
            inputMode="numeric"
            placeholder={t("botProtection.answerPlaceholder")}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className={`w-24 ${isVerified ? "border-primary bg-primary/5" : ""}`}
            disabled={isVerified}
            autoComplete="off"
          />
          {isVerified && (
            <span className="text-sm text-primary font-medium flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {t("botProtection.verified")}
            </span>
          )}
        </div>
        {attempts > 2 && !isVerified && (
          <p className="text-xs text-destructive">
            {t("botProtection.retryHint", { problem: mathProblem.question })}
          </p>
        )}
      </div>
    </div>
  );
};

export default BotProtection;
