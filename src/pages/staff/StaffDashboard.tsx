import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { useStaffRealtimeBookings } from "@/hooks/useStaffRealtimeBookings";
import { StaffHeader } from "@/components/staff/StaffHeader";
import { StaffWorkingDays } from "@/components/staff/StaffWorkingDays";
import { StaffDayView } from "@/components/staff/StaffDayView";
import { StaffBookingDetail } from "@/components/staff/StaffBookingDetail";
import { StaffPerformanceCard } from "@/components/staff/StaffPerformanceCard";
import type { StaffWorkingDay } from "@/components/staff/StaffWorkingDays";
import type { StaffBooking } from "@/hooks/useStaffBookings";

const StaffDashboard = () => {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const { isConnected, highlightedId } = useStaffRealtimeBookings();

  const [selectedDay, setSelectedDay] = useState<StaffWorkingDay | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<StaffBooking | null>(null);

  const handleSignOut = async () => {
    await signOut();
    window.location.replace("/staff/login");
  };

  const handleBack = () => {
    if (selectedBooking) {
      setSelectedBooking(null);
    } else if (selectedDay) {
      setSelectedDay(null);
    }
  };

  const breadcrumb = selectedDay
    ? selectedBooking
      ? t("staff.header.bookingDetails")
      : selectedDay.venueName
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <StaffHeader
        isConnected={isConnected}
        onSignOut={handleSignOut}
        userEmail={user?.email}
        breadcrumb={breadcrumb}
        onBack={selectedDay ? handleBack : undefined}
      />

      <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {!selectedDay ? (
          <>
            <StaffPerformanceCard />
            <StaffWorkingDays onSelectDay={setSelectedDay} />
          </>
        ) : !selectedBooking ? (
          <StaffDayView
            day={selectedDay}
            highlightedId={highlightedId}
            onSelectBooking={setSelectedBooking}
          />
        ) : (
          <StaffBookingDetail
            booking={selectedBooking}
            onBack={() => setSelectedBooking(null)}
          />
        )}
      </main>
    </div>
  );
};

export default StaffDashboard;
