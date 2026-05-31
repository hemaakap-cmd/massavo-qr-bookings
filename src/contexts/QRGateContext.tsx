import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QrCode, ScanLine } from "lucide-react";

type QRGateType = "gym" | "hotel" | "any";

interface QRGateContextValue {
  openQRGate: (type?: QRGateType) => void;
  closeQRGate: () => void;
}

const QRGateContext = createContext<QRGateContextValue | null>(null);

export const useQRGate = () => {
  const ctx = useContext(QRGateContext);
  if (!ctx) throw new Error("useQRGate must be used inside QRGateProvider");
  return ctx;
};

export const QRGateProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QRGateType>("any");

  const openQRGate = useCallback((nextType: QRGateType = "any") => {
    setType(nextType);
    setOpen(true);
  }, []);

  const closeQRGate = useCallback(() => setOpen(false), []);

  // Auto-close on Escape is handled by Radix; ensure body scroll restoration
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const title =
    type === "gym"
      ? t("qrGate.titleGym", { defaultValue: t("qrGate.title") })
      : type === "hotel"
      ? t("qrGate.titleHotel", { defaultValue: t("qrGate.title") })
      : t("qrGate.title");

  return (
    <QRGateContext.Provider value={{ openQRGate, closeQRGate }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border-border/60 bg-gradient-to-b from-card to-card/80 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col items-center text-center pt-2">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-lg animate-scale-in">
                <QrCode className="w-10 h-10" />
              </div>
            </div>
            <DialogHeader className="space-y-3">
              <DialogTitle className="font-display text-2xl md:text-3xl font-bold text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground leading-relaxed">
                {t("qrGate.message")}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 w-full rounded-xl border border-border/60 bg-secondary/40 p-4 flex items-center gap-3 animate-fade-in">
              <ScanLine className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm text-foreground/80 text-left rtl:text-right">
                {t("qrGate.hint")}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-6 inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              {t("qrGate.dismiss")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </QRGateContext.Provider>
  );
};