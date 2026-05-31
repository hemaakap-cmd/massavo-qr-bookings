import { useEffect, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasQRAccess } from "@/lib/qrAccess";
import { useQRGate } from "@/contexts/QRGateContext";

interface QRGuardProps {
  type?: "gym" | "hotel" | "any";
  children: ReactNode;
}

/**
 * Route guard: blocks public access to gym/hotel listing and pricing pages
 * unless the visitor arrived via a QR code (which calls grantQRAccess()).
 */
export const QRGuard = ({ type = "any", children }: QRGuardProps) => {
  const allowed = hasQRAccess(type);
  const { openQRGate } = useQRGate();

  useEffect(() => {
    if (!allowed) openQRGate(type);
  }, [allowed, openQRGate, type]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};