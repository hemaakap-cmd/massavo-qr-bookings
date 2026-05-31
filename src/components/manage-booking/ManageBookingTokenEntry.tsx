import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Search, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  onSubmit: (token: string) => void;
}

export function ManageBookingTokenEntry({ onSubmit }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">
          {t("manageBookingEntry.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("manageBookingEntry.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            {t("manageBookingEntry.findTitle")}
          </CardTitle>
          <CardDescription>
            {t("manageBookingEntry.findDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                placeholder={t("manageBookingEntry.placeholder")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="text-sm"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={!value.trim()}>
              <Search className="h-4 w-4 mr-2" />
              {t("manageBookingEntry.searchButton")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 border-accent bg-accent/10">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Mail className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">{t("manageBookingEntry.helpTitle")}</p>
              <p>{t("manageBookingEntry.helpText")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
