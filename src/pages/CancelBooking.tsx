import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, Clock, MapPin, Search, Loader2, XCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BookingItem {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  customer_name: string | null;
  canCancel: boolean;
  hoursUntil: number;
  gymName: string;
  serviceName: string;
  duration: number;
}

const CancelBooking = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [tokenBooking, setTokenBooking] = useState<BookingItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isTokenMode, setIsTokenMode] = useState(false);

  useEffect(() => {
    if (tokenFromUrl) {
      setIsTokenMode(true);
      handleTokenLookup(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleTokenLookup = async (token: string) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { token, action: "token-lookup" },
      });

      if (error) throw error;

      if (data.success && data.booking) {
        setTokenBooking(data.booking);
      } else {
        throw new Error(data.error || t("cancelBooking.notFoundError"));
      }
    } catch (error) {
      console.error("Token lookup error:", error);
      toast({
        title: t("cancelBooking.error"),
        description: error instanceof Error ? error.message : t("cancelBooking.invalidLink"),
        variant: "destructive",
      });
      setTokenBooking(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookup = async () => {
    if (!email.trim()) {
      toast({
        title: t("cancelBooking.emailRequired"),
        description: t("cancelBooking.emailRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { email: email.trim(), action: "lookup" },
      });

      if (error) throw error;

      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        throw new Error(data.error || t("cancelBooking.fetchError"));
      }
    } catch (error) {
      console.error("Lookup error:", error);
      toast({
        title: t("cancelBooking.error"),
        description: error instanceof Error ? error.message : t("cancelBooking.error"),
        variant: "destructive",
      });
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    const bookingToCancel = selectedBooking || tokenBooking;
    if (!bookingToCancel) return;

    setIsCancelling(true);

    try {
      const requestBody = isTokenMode && tokenFromUrl
        ? { token: tokenFromUrl, action: "token-cancel" }
        : { email: email.trim(), bookingId: bookingToCancel.id, action: "cancel" };

      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: requestBody,
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t("cancelBooking.cancelledTitle"),
          description: data.refunded 
            ? t("cancelBooking.cancelledRefund")
            : t("cancelBooking.cancelledNoRefund"),
        });
        
        if (isTokenMode) {
          setTokenBooking(null);
        } else {
          setBookings(prev => prev.filter(b => b.id !== bookingToCancel.id));
        }
        setSelectedBooking(null);
      } else {
        throw new Error(data.error || t("cancelBooking.cancelError"));
      }
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: t("cancelBooking.cancelFailed"),
        description: error instanceof Error ? error.message : t("cancelBooking.error"),
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5) + " Uhr";
  };

  const dialogBooking = selectedBooking || (isTokenMode ? tokenBooking : null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("cancelBooking.title")}
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              {isTokenMode 
                ? t("cancelBooking.subtitleToken")
                : t("cancelBooking.subtitleEmail")
              }
            </p>
          </div>

          <Card className="mb-8 border-accent bg-accent/10">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-accent-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">
                    {t("cancelBooking.policyTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("cancelBooking.policyDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isTokenMode && (
            <div className="space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <Loader2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                    <h3 className="font-medium text-foreground mb-2">{t("cancelBooking.loadingBooking")}</h3>
                  </CardContent>
                </Card>
              ) : tokenBooking ? (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      {t("cancelBooking.yourBooking")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">
                            {tokenBooking.serviceName}
                          </h3>
                          <Badge variant={tokenBooking.canCancel ? "outline" : "secondary"}>
                            {tokenBooking.duration} Min
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {tokenBooking.gymName}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(tokenBooking.booking_date)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {formatTime(tokenBooking.booking_time)}
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border">
                          <span className="font-semibold text-foreground">
                            €{tokenBooking.total_amount}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {tokenBooking.canCancel ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setSelectedBooking(tokenBooking)}
                          >
                            {t("cancelBooking.cancel")}
                          </Button>
                        ) : (
                          <div className="text-right">
                            <Badge variant="secondary" className="mb-2">
                              {t("cancelBooking.notCancellable")}
                            </Badge>
                            <p className="text-xs text-muted-foreground max-w-[120px]">
                              {t("cancelBooking.appointmentIn", { hours: tokenBooking.hoursUntil })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : hasSearched ? (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium text-foreground mb-2">{t("cancelBooking.notFound")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("cancelBooking.notFoundDesc")}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {!isTokenMode && (
            <>
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="text-lg">{t("cancelBooking.searchTitle")}</CardTitle>
                  <CardDescription>
                    {t("cancelBooking.searchDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label htmlFor="email" className="sr-only">E-Mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("cancelBooking.emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                        className="bg-background"
                      />
                    </div>
                    <Button 
                      onClick={handleLookup} 
                      disabled={isLoading}
                      variant="sage"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          {t("cancelBooking.search")}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {hasSearched && !isLoading && (
                <div className="space-y-4">
                  {bookings.length === 0 ? (
                    <Card>
                      <CardContent className="pt-6 text-center py-12">
                        <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-medium text-foreground mb-2">{t("cancelBooking.noBookings")}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("cancelBooking.noBookingsDesc")}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <h2 className="font-display text-lg font-semibold text-foreground">
                        {bookings.length === 1 
                          ? t("cancelBooking.bookingsFound", { count: bookings.length })
                          : t("cancelBooking.bookingsFoundPlural", { count: bookings.length })
                        }
                      </h2>
                      
                      {bookings.map((booking) => (
                        <Card key={booking.id} className="overflow-hidden">
                          <CardContent className="p-0">
                            <div className="p-6">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-foreground">
                                      {booking.serviceName}
                                    </h3>
                                    <Badge variant={booking.canCancel ? "outline" : "secondary"}>
                                      {booking.duration} Min
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="w-4 h-4" />
                                      {booking.gymName}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4" />
                                      {formatDate(booking.booking_date)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4" />
                                      {formatTime(booking.booking_time)}
                                    </div>
                                  </div>

                                  <div className="mt-3 pt-3 border-t border-border">
                                    <span className="font-semibold text-foreground">
                                      €{booking.total_amount}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  {booking.canCancel ? (
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => setSelectedBooking(booking)}
                                    >
                                      {t("cancelBooking.cancel")}
                                    </Button>
                                  ) : (
                                    <div className="text-right">
                                      <Badge variant="secondary" className="mb-2">
                                        {t("cancelBooking.notCancellable")}
                                      </Badge>
                                      <p className="text-xs text-muted-foreground max-w-[120px]">
                                        {t("cancelBooking.appointmentIn", { hours: booking.hoursUntil })}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={!!dialogBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelBooking.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("cancelBooking.confirmDesc")}
            </DialogDescription>
          </DialogHeader>

          {dialogBooking && (
            <div className="py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cancelBooking.serviceLabel")}</span>
                <span className="font-medium">{dialogBooking.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cancelBooking.locationLabel")}</span>
                <span className="font-medium">{dialogBooking.gymName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cancelBooking.dateLabel")}</span>
                <span className="font-medium">{formatDate(dialogBooking.booking_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cancelBooking.timeLabel")}</span>
                <span className="font-medium">{formatTime(dialogBooking.booking_time)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="text-muted-foreground">{t("cancelBooking.refundLabel")}</span>
                <span className="font-semibold text-primary">€{dialogBooking.total_amount}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="luxuryOutline"
              onClick={() => setSelectedBooking(null)}
              disabled={isCancelling}
            >
              {t("cancelBooking.keepBooking")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t("cancelBooking.cancelling")}
                </>
              ) : (
                t("cancelBooking.confirmCancel")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default CancelBooking;
