import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useManageBooking } from "@/hooks/useManageBooking";
import { ManageBookingDetails } from "@/components/manage-booking/ManageBookingDetails";
import { ManageBookingReschedule } from "@/components/manage-booking/ManageBookingReschedule";
import { ManageBookingSuccess } from "@/components/manage-booking/ManageBookingSuccess";
import { ManageBookingError } from "@/components/manage-booking/ManageBookingError";
import { ManageBookingTokenEntry } from "@/components/manage-booking/ManageBookingTokenEntry";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ManageAction = "choose" | "reschedule" | "cancel-confirm" | "success-reschedule" | "success-cancel";

export default function ManageBooking() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlToken = searchParams.get("token") || "";
  const [manualToken, setManualToken] = useState("");
  const token = urlToken || manualToken;
  
  const { booking, isLoading, isError, error, reschedule, cancel } = useManageBooking(token);
  const [action, setAction] = useState<ManageAction>("choose");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  // Re-typed by the user to confirm ownership when rescheduling (defense
  // against cancellation-token-leak hijacks).
  const [confirmEmail, setConfirmEmail] = useState("");

  const handleTokenSubmit = (enteredToken: string) => {
    // Try to extract token from a full URL if user pastes one
    try {
      const url = new URL(enteredToken);
      const t = url.searchParams.get("token");
      if (t) {
        setSearchParams({ token: t });
        return;
      }
    } catch {
      // Not a URL, treat as raw token
    }
    setSearchParams({ token: enteredToken.trim() });
  };

  // No token provided — show entry form
  if (!token) {
    return (
      <PageShell>
        <ManageBookingTokenEntry onSubmit={handleTokenSubmit} />
      </PageShell>
    );
  }

  if (isLoading) {
    return (
      <PageShell>
        <Card><CardContent className="py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t("manageHook.loading")}</p>
        </CardContent></Card>
      </PageShell>
    );
  }

  if (isError || !booking) {
    return (
      <PageShell>
        <ManageBookingError message={error instanceof Error ? error.message : t("manageHook.notFoundOrCancelled")} />
      </PageShell>
    );
  }

  if (action === "success-reschedule") {
    return (
      <PageShell>
        <ManageBookingSuccess
          type="reschedule"
          newDate={newDate}
          newTime={newTime}
          serviceName={booking.serviceName}
          gymName={booking.gymName}
        />
      </PageShell>
    );
  }

  if (action === "success-cancel") {
    return (
      <PageShell>
        <ManageBookingSuccess type="cancel" serviceName={booking.serviceName} gymName={booking.gymName} />
      </PageShell>
    );
  }

  if (action === "reschedule") {
    return (
      <PageShell>
        <ManageBookingReschedule
          booking={booking}
          selectedDate={newDate}
          selectedTime={newTime}
          confirmEmail={confirmEmail}
          onSelectDate={setNewDate}
          onSelectTime={setNewTime}
          onConfirmEmailChange={setConfirmEmail}
          onConfirm={async () => {
            await reschedule.mutateAsync({ newDate, newTime, customerEmail: confirmEmail });
            setAction("success-reschedule");
          }}
          onBack={() => { setAction("choose"); setNewDate(""); setNewTime(""); setConfirmEmail(""); }}
          isPending={reschedule.isPending}
          error={reschedule.error instanceof Error ? reschedule.error.message : null}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ManageBookingDetails
        booking={booking}
        onReschedule={() => setAction("reschedule")}
        onCancel={async () => {
          await cancel.mutateAsync();
          setAction("success-cancel");
        }}
        isCancelling={cancel.isPending}
        cancelError={cancel.error instanceof Error ? cancel.error.message : null}
      />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-2xl py-24 px-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}
