import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/i18n";

interface PaymentDetails {
  serviceId: string;
  therapistName?: string;
  timeSlot?: string;
  bookingDate?: string;
  gymName?: string;
  gymId?: string;
  hotelId?: string;
  hotelName?: string;
  venueType?: "gym" | "hotel";
  customerEmail?: string;
  clientName?: string;
  clientAge?: number;
  clientPhone?: string;
  clientAddress?: string;
  healthConfirmed?: boolean;
  dateOfBirth?: string;
  salutation?: string;
  gender?: string | null;
  pregnancyStatus?: string | null;
  notes?: string;
  communicationPreference?: string;
  selectedBodyAreas?: Array<{ code: string; label?: string; painIntensity: number }>;
  deepTissueUpgradeActive?: boolean;
}

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const lastClickRef = useRef<number>(0);
  const DEBOUNCE_MS = 2000; // Prevent clicks within 2 seconds

  const initiatePayment = useCallback(async (details: PaymentDetails) => {
    // Prevent double-clicks
    const now = Date.now();
    if (now - lastClickRef.current < DEBOUNCE_MS) {
      console.log("Payment request debounced - too soon after last click");
      return;
    }
    lastClickRef.current = now;

    // Prevent concurrent requests
    if (isLoading) {
      console.log("Payment already in progress");
      return;
    }

    setIsLoading(true);

    try {
      // Validate required fields
      if (!details.serviceId) {
        throw new Error(i18n.t("paymentToast.selectService"));
      }

      // Always use the dynamic checkout session via edge function
      // This ensures all payment methods (Cards, Google Pay, Apple Pay, PayPal)
      // are available based on Stripe Dashboard configuration

      // Otherwise, use the edge function for dynamic checkout
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: details,
      });

      if (error) {
        // Handle specific error cases
        if (error.message?.includes("Rate limit") || error.message?.includes("429")) {
          throw new Error(i18n.t("paymentToast.rateLimit"));
        }
        throw new Error(error.message || i18n.t("paymentToast.createFailed"));
      }

      // Handle slot conflict (409 from pre-payment validation)
      if (data?.error && !data?.url) {
        throw new Error(data.error);
      }

      if (data?.url) {
        // Show loading toast before redirect
        toast.info(i18n.t("paymentToast.redirecting"), { duration: 2000 });
        
        // Redirect to Stripe checkout (same tab for mobile compatibility)
        window.location.href = data.url;
      } else {
        throw new Error(i18n.t("paymentToast.noUrl"));
      }
    } catch (error) {
      console.error("Payment error:", error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : i18n.t("paymentToast.failed");
      toast.error(errorMessage);
      
      // Re-enable after error
      setIsLoading(false);
    }
    // Note: We don't setIsLoading(false) on success because we're redirecting
  }, [isLoading]);

  return {
    initiatePayment,
    isLoading,
  };
};
