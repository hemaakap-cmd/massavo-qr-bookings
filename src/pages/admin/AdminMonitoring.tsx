import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useBookingEvents } from "@/hooks/useBookingEvents";
import { MonitoringHeader } from "@/components/admin/monitoring/MonitoringHeader";
import { MonitoringStats } from "@/components/admin/monitoring/MonitoringStats";
import { MonitoringFilters } from "@/components/admin/monitoring/MonitoringFilters";
import { EventFeed } from "@/components/admin/monitoring/EventFeed";
import { RescheduleNotificationsTab } from "@/components/admin/monitoring/RescheduleNotificationsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

const AdminMonitoring = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);

  const [venueFilter, setVenueFilter] = useState("all");
  const [venueTypeFilter, setVenueTypeFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const { events, loading, realtimeConnected, stats } = useBookingEvents({
    venueFilter,
    venueTypeFilter,
    eventTypeFilter,
    severityFilter,
    countryId: selectedCountry?.id,
    limit: 200,
    realtime: true,
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <MonitoringHeader realtimeConnected={realtimeConnected} />

        <MonitoringStats stats={stats} />

        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="reschedules">Reschedule Notifications</TabsTrigger>
          </TabsList>
          <TabsContent value="events" className="space-y-4">
            <MonitoringFilters
              countryId={selectedCountry?.id}
              venueFilter={venueFilter}
              setVenueFilter={setVenueFilter}
              venueTypeFilter={venueTypeFilter}
              setVenueTypeFilter={setVenueTypeFilter}
              eventTypeFilter={eventTypeFilter}
              setEventTypeFilter={setEventTypeFilter}
              severityFilter={severityFilter}
              setSeverityFilter={setSeverityFilter}
            />
            <EventFeed events={events} loading={loading} />
          </TabsContent>
          <TabsContent value="reschedules">
            <RescheduleNotificationsTab countryId={selectedCountry?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMonitoring;
