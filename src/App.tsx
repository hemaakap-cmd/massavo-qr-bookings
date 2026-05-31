import { useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index"; // eager — landing page (LCP critical)
const Cities = lazy(() => import("./pages/Cities"));
const Book = lazy(() => import("./pages/Book"));
const CityPage = lazy(() => import("./pages/CityPage"));
const GymPage = lazy(() => import("./pages/GymPage"));
const Hotels = lazy(() => import("./pages/Hotels"));
const HotelsCityPage = lazy(() => import("./pages/HotelsCityPage"));
const HotelPage = lazy(() => import("./pages/HotelPage"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("./pages/PaymentCanceled"));
const CancelBooking = lazy(() => import("./pages/CancelBooking"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminVerify = lazy(() => import("./pages/admin/AdminVerify"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminFederalStates = lazy(() => import("./pages/admin/AdminFederalStates"));
const AdminCounties = lazy(() => import("./pages/admin/AdminCounties"));
const AdminCities = lazy(() => import("./pages/admin/AdminCities"));
const AdminGyms = lazy(() => import("./pages/admin/AdminGyms"));
const AdminHotels = lazy(() => import("./pages/admin/AdminHotels"));
const AdminTherapists = lazy(() => import("./pages/admin/AdminTherapists"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminQRCodes = lazy(() => import("./pages/admin/AdminQRCodes"));
const AdminFinancial = lazy(() => import("./pages/admin/AdminFinancial"));
const AdminDailyAssignments = lazy(() => import("./pages/admin/AdminDailyAssignments"));
const AdminReporting = lazy(() => import("./pages/admin/AdminReporting"));
const AdminGymProfiles = lazy(() => import("./pages/admin/AdminGymProfiles"));
const AdminHotelProfiles = lazy(() => import("./pages/admin/AdminHotelProfiles"));
const AdminSchedules = lazy(() => import("./pages/admin/AdminSchedules"));
const AdminSchedulingConfig = lazy(() => import("./pages/admin/AdminSchedulingConfig"));
const AdminMonitoring = lazy(() => import("./pages/admin/AdminMonitoring"));
const AdminPaymentVerifications = lazy(() => import("./pages/admin/AdminPaymentVerifications"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth"));
const AdminAIAssistant = lazy(() => import("./pages/admin/AdminAIAssistant"));
const AdminTherapistAnalytics = lazy(() => import("./pages/admin/AdminTherapistAnalytics"));
const AdminPainEvolution = lazy(() => import("./pages/admin/AdminPainEvolution"));
const AdminWeeklyPlanner = lazy(() => import("./pages/admin/AdminWeeklyPlanner"));
const AdminAdvancedAnalytics = lazy(() => import("./pages/admin/AdminAdvancedAnalytics"));
const AdminBusinessIntelligence = lazy(() => import("./pages/admin/AdminBusinessIntelligence"));
const AdminStaffAdvanced = lazy(() => import("./pages/admin/AdminStaffAdvanced"));
const AdminClientData = lazy(() => import("./pages/admin/AdminClientData"));
const AdminWorkTracking = lazy(() => import("./pages/admin/AdminWorkTracking"));
const AdminTherapistAbsence = lazy(() => import("./pages/admin/AdminTherapistAbsence"));
const AdminTherapistLeaves = lazy(() => import("./pages/admin/AdminTherapistLeaves"));
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices"));
const StaffLogin = lazy(() => import("./pages/staff/StaffLogin"));
const StaffVerify = lazy(() => import("./pages/staff/StaffVerify"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const RescheduleBooking = lazy(() => import("./pages/RescheduleBooking"));
const ManageBooking = lazy(() => import("./pages/ManageBooking"));
const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Contact = lazy(() => import("./pages/Contact"));
const PrintQR = lazy(() => import("./pages/PrintQR"));
const BagMockup = lazy(() => import("./pages/BagMockup"));
const ScanQR = lazy(() => import("./pages/ScanQR"));
const ShareQR = lazy(() => import("./pages/ShareQR"));
const QRCodeDetail = lazy(() => import("./pages/QRCodeDetail"));
const PrintBooking = lazy(() => import("./pages/PrintBooking"));
const AdminScanBooking = lazy(() => import("./pages/admin/AdminScanBooking"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
import ScrollToTop from "./components/layout/ScrollToTop";
import { VisitorTracker } from "./components/VisitorTracker";
import CookieConsent from "./components/CookieConsent";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Impressum = lazy(() => import("./pages/Impressum"));
const BookingPolicy = lazy(() => import("./pages/BookingPolicy"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy"));
const Feedback = lazy(() => import("./pages/Feedback"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
import { StaffRouteGuard } from "./components/staff/StaffRouteGuard";
import { CountryProvider } from "./contexts/CountryContext";
import { QRGateProvider } from "./contexts/QRGateContext";
import { QRGuard } from "./components/QRGuard";
import ErrorBoundary from "./components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Batch D: sane defaults to reduce refetch storms
      staleTime: 60 * 1000, // 1 min fresh
      gcTime: 5 * 60 * 1000, // 5 min cache
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Suspense fallback shown while a lazy route chunk loads
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// RTL support component
function DirectionHandler() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return null;
}

// Batch D: noindex for private surfaces (admin, staff, management, payment confirmation, manage-booking)
function PrivateRouteNoIndex() {
  const { pathname } = useLocation();
  const isPrivate = /^\/(admin|staff|super-admin|management|manage-booking|reschedule|cancel-booking|payment-success|payment-canceled|feedback|print-booking|print-qr|share-qr)(\/|$)/.test(pathname);
  if (!isPrivate) return null;
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow, noarchive" />
    </Helmet>
  );
}

const App = () => (
  <ErrorBoundary>
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <CountryProvider>
    <TooltipProvider>
    <QRGateProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DirectionHandler />
        <PrivateRouteNoIndex />
        <ScrollToTop />
        <StaffRouteGuard />
        <VisitorTracker />
        <CookieConsent />
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/book" element={<QRGuard><Book /></QRGuard>} />
          <Route path="/cities" element={<QRGuard type="gym"><Cities /></QRGuard>} />
          <Route path="/city/:cityId" element={<QRGuard type="gym"><CityPage /></QRGuard>} />
          <Route path="/gym/:gymId" element={<GymPage />} />
          <Route path="/hotels" element={<QRGuard type="hotel"><Hotels /></QRGuard>} />
          <Route path="/hotels/city/:cityId" element={<QRGuard type="hotel"><HotelsCityPage /></QRGuard>} />
          <Route path="/hotel/:hotelId" element={<HotelPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
          <Route path="/cancel-booking" element={<CancelBooking />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/print-qr" element={<PrintQR />} />
          <Route path="/bag-mockup" element={<BagMockup />} />
          <Route path="/scan" element={<ScanQR />} />
          <Route path="/share-qr" element={<ShareQR />} />
          <Route path="/qr/:id" element={<QRCodeDetail />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/booking-policy" element={<BookingPolicy />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/reschedule" element={<RescheduleBooking />} />
          <Route path="/manage-booking" element={<ManageBooking />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/print-booking" element={<PrintBooking />} />

          {/* Admin OTP login */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/verify" element={<AdminVerify />} />

          {/* Staff OTP login */}
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/verify" element={<StaffVerify />} />

          {/* Protected admin routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/federal-states" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminFederalStates /></ProtectedRoute>} />
          <Route path="/admin/counties" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminCounties /></ProtectedRoute>} />
          <Route path="/admin/cities" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminCities /></ProtectedRoute>} />
          <Route path="/admin/gyms" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminGyms /></ProtectedRoute>} />
          <Route path="/admin/hotels" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminHotels /></ProtectedRoute>} />
          <Route path="/admin/services" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminServices /></ProtectedRoute>} />
          <Route path="/admin/therapists" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTherapists /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/financial" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminFinancial /></ProtectedRoute>} />
          <Route path="/admin/daily-assignments" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDailyAssignments /></ProtectedRoute>} />
          <Route path="/admin/reporting" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminReporting /></ProtectedRoute>} />
          <Route path="/admin/gym-profiles" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminGymProfiles /></ProtectedRoute>} />
          <Route path="/admin/hotel-profiles" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminHotelProfiles /></ProtectedRoute>} />
          <Route path="/admin/schedules" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSchedules /></ProtectedRoute>} />
          <Route path="/admin/scheduling-config" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSchedulingConfig /></ProtectedRoute>} />
          <Route path="/admin/qr-codes" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminQRCodes /></ProtectedRoute>} />
          <Route path="/admin/scan-booking" element={<ProtectedRoute allowedRoles={["admin", "super_admin", "therapist"]}><AdminScanBooking /></ProtectedRoute>} />
          <Route path="/admin/monitoring" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminMonitoring /></ProtectedRoute>} />
          <Route path="/admin/payment-verifications" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminPaymentVerifications /></ProtectedRoute>} />
          <Route path="/admin/system-health" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSystemHealth /></ProtectedRoute>} />
          <Route path="/admin/ai-assistant" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminAIAssistant /></ProtectedRoute>} />
          <Route path="/admin/therapist-analytics" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTherapistAnalytics /></ProtectedRoute>} />
          <Route path="/admin/pain-evolution" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminPainEvolution /></ProtectedRoute>} />
          <Route path="/admin/weekly-planner" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminWeeklyPlanner /></ProtectedRoute>} />
          <Route path="/admin/advanced-analytics" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminAdvancedAnalytics /></ProtectedRoute>} />
          <Route path="/admin/business-intelligence" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminBusinessIntelligence /></ProtectedRoute>} />
          <Route path="/admin/staff-advanced" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminStaffAdvanced /></ProtectedRoute>} />
          <Route path="/admin/reviews" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminReviews /></ProtectedRoute>} />
          <Route path="/admin/client-data" element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminClientData /></ProtectedRoute>} />

          {/* Protected super admin routes */}
          <Route path="/admin/work-tracking" element={<ProtectedRoute allowedRoles={["super_admin"]}><AdminWorkTracking /></ProtectedRoute>} />
          <Route path="/admin/therapist-absence" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTherapistAbsence /></ProtectedRoute>} />
          <Route path="/admin/therapist-leaves" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTherapistLeaves /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>} />

          {/* Protected staff routes */}
          <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={["therapist"]}><StaffDashboard /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QRGateProvider>
    </TooltipProvider>
    </CountryProvider>
  </QueryClientProvider>
  </HelmetProvider>
  </ErrorBoundary>
);

export default App;
