import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface Props {
  message: string;
}

export function ManageBookingError({ message }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="pt-10 pb-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">{t("manageBookingError.notFound")}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">{message}</p>
        <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
          <Home className="h-4 w-4 mr-2" /> {t("manageBookingError.backHome")}
        </Button>
      </CardContent>
    </Card>
  );
}
