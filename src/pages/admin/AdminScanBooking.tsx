import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle,
  User, Calendar, Clock, MapPin, Stethoscope, Loader2, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface ScannedBooking {
  id: string;
  status: string;
  booking_date: string;
  booking_time: string;
  customer_name: string | null;
  customer_email: string | null;
  total_amount: number;
  payment_status: string;
  gym: { name: string; address: string } | null;
  service: { name: string; duration_minutes: number } | null;
  therapist: { name: string } | null;
}

function extractToken(text: string): string | null {
  // Accept either a raw UUID or a URL containing ?token=<uuid>
  try {
    const url = new URL(text);
    const t = url.searchParams.get("token");
    if (t && UUID_RE.test(t)) return t.toLowerCase();
  } catch {
    /* not a URL — fall through */
  }
  const m = text.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}

const AdminScanBooking = () => {
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<ScannedBooking | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => () => { void stopScanner(); }, []);

  const lookupBooking = async (token: string) => {
    setLoading(true);
    setErrorMsg(null);
    setBooking(null);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id, status, booking_date, booking_time,
          customer_name, customer_email,
          total_amount, payment_status,
          gym:gyms(name, address),
          service:services(name, duration_minutes),
          therapist:therapists(name)
        `)
        .eq("cancellation_token", token)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setErrorMsg("Booking not found for the scanned QR code.");
      } else {
        const gym = Array.isArray(data.gym) ? data.gym[0] : data.gym;
        const service = Array.isArray(data.service) ? data.service[0] : data.service;
        const therapist = Array.isArray(data.therapist) ? data.therapist[0] : data.therapist;
        setBooking({ ...data, gym, service, therapist } as ScannedBooking);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setBooking(null);
    setErrorMsg(null);
    setScanning(true);
    try {
      const html5 = new Html5Qrcode("admin-qr-reader");
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded) => {
          const token = extractToken(decoded);
          if (!token) {
            toast({ title: "Unrecognized QR", description: "No booking token found.", variant: "destructive" });
            return;
          }
          await stopScanner();
          await lookupBooking(token);
        },
        () => { /* ignore frame errors */ }
      );
    } catch (e: any) {
      console.error(e);
      toast({ title: "Camera error", description: e?.message || "Unable to access camera.", variant: "destructive" });
      setScanning(false);
    }
  };

  const reset = async () => {
    await stopScanner();
    setBooking(null);
    setErrorMsg(null);
  };

  const isCancelled = booking?.status === "cancelled";
  const isConfirmed = booking?.status === "confirmed";

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Scan Booking QR</h1>
          <p className="text-sm text-muted-foreground">
            Scan a customer's booking QR code to verify status and view details.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Camera</CardTitle>
            {scanning ? (
              <Button variant="outline" size="sm" onClick={stopScanner}>
                <CameraOff className="w-4 h-4 mr-1" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={startScanner}>
                <Camera className="w-4 h-4 mr-1" /> Start scanner
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div
              id="admin-qr-reader"
              className="w-full max-w-md mx-auto rounded-lg overflow-hidden bg-muted"
              style={{ minHeight: scanning ? 280 : 0 }}
            />
            {!scanning && !booking && !loading && !errorMsg && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Press “Start scanner” and point the camera at a booking QR code.
              </p>
            )}
          </CardContent>
        </Card>

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Looking up booking…
            </CardContent>
          </Card>
        )}

        {errorMsg && !loading && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-5 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>{errorMsg}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
                <RotateCcw className="w-4 h-4 mr-1" /> Reset
              </Button>
            </CardContent>
          </Card>
        )}

        {booking && (
          <Card
            className={
              isCancelled
                ? "border-destructive/40 bg-destructive/5"
                : isConfirmed
                ? "border-green-500/40 bg-green-500/5"
                : "border-warning/40 bg-warning/5"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCancelled ? (
                    <XCircle className="w-6 h-6 text-destructive" />
                  ) : isConfirmed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-warning" />
                  )}
                  <CardTitle className="text-lg">
                    {isCancelled
                      ? "Booking Cancelled"
                      : isConfirmed
                      ? "Valid Booking"
                      : `Status: ${booking.status}`}
                  </CardTitle>
                </div>
                <Badge variant="outline" className="font-mono">
                  #{booking.id.slice(0, 8).toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow icon={User} label="Client" value={booking.customer_name || "—"} />
              <DetailRow icon={Calendar} label="Date" value={booking.booking_date} />
              <DetailRow icon={Clock} label="Time" value={`${booking.booking_time.slice(0, 5)} · ${booking.service?.duration_minutes ?? "—"} min`} />
              <DetailRow icon={Stethoscope} label="Service" value={booking.service?.name || "—"} />
              <DetailRow icon={User} label="Therapist" value={booking.therapist?.name || "—"} />
              <DetailRow icon={MapPin} label="Location" value={booking.gym?.name || "—"} />
              {booking.gym?.address && (
                <p className="text-sm text-muted-foreground pl-7">{booking.gym.address}</p>
              )}
              <div className="pt-3 border-t border-border flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">Payment: {booking.payment_status}</Badge>
                <Badge variant="secondary">Email: {booking.customer_email || "—"}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="w-4 h-4 mr-1" /> Scan another
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

const DetailRow = ({
  icon: Icon, label, value,
}: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  </div>
);

export default AdminScanBooking;