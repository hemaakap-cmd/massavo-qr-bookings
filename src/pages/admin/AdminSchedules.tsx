import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { GymScheduleManager } from "@/components/admin/schedules/GymScheduleManager";
import { HotelScheduleManager } from "@/components/admin/schedules/HotelScheduleManager";
import { ScheduleExceptionManager } from "@/components/admin/schedules/ScheduleExceptionManager";
import { AffectedBookingsDashboard } from "@/components/admin/schedules/AffectedBookingsDashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, CalendarX, AlertCircle, Building2, Hotel as HotelIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

export default function AdminSchedules() {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const [venueType, setVenueType] = useState<"gym" | "hotel">("gym");
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [selectedHotelId, setSelectedHotelId] = useState<string>("");

  const { data: gyms = [], isLoading: gymsLoading } = useQuery({
    queryKey: ["admin-gyms", selectedCountry?.id],
    queryFn: async () => {
      let query = supabase
        .from("gyms")
        .select("id, name, city:cities(name)")
        .eq("is_active", true)
        .order("name");

      if (selectedCountry?.id) {
        query = query.eq("country_id", selectedCountry.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ["admin-hotels-schedules", selectedCountry?.id],
    queryFn: async () => {
      let q = supabase.from("hotels").select("id, name, cities(name)").eq("is_active", true).order("name");
      if (selectedCountry?.id) q = q.eq("country_id", selectedCountry.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const selectedGym = gyms.find((g) => g.id === selectedGymId);
  const selectedHotel = hotels.find((h) => h.id === selectedHotelId);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Venue Schedules</h1>
          <p className="text-muted-foreground">
            Manage recurring weekly schedules and exceptions per gym or hotel
          </p>
        </div>

        <Tabs value={venueType} onValueChange={(v) => setVenueType(v as "gym" | "hotel")} className="w-full">
          <TabsList>
            <TabsTrigger value="gym" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Gyms
            </TabsTrigger>
            <TabsTrigger value="hotel" className="flex items-center gap-2">
              <HotelIcon className="h-4 w-4" /> Hotels
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gym" className="space-y-6 mt-4">
        <div className="max-w-sm">
          <Label htmlFor="gym-select">Select Gym</Label>
          <Select value={selectedGymId} onValueChange={setSelectedGymId}>
            <SelectTrigger id="gym-select" className="mt-1">
              <SelectValue placeholder="Choose a gym to manage" />
            </SelectTrigger>
            <SelectContent>
              {gyms.map((gym) => (
                <SelectItem key={gym.id} value={gym.id}>
                  {gym.name} {gym.city?.name ? `(${gym.city.name})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedGymId && selectedGym && (
          <Tabs defaultValue="schedule" className="space-y-4">
            <TabsList>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly Schedule
              </TabsTrigger>
              <TabsTrigger value="exceptions" className="flex items-center gap-2">
                <CalendarX className="h-4 w-4" />
                Exceptions
              </TabsTrigger>
              <TabsTrigger value="affected" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Affected Bookings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <GymScheduleManager gymId={selectedGymId} gymName={selectedGym.name} />
            </TabsContent>

            <TabsContent value="exceptions">
              <ScheduleExceptionManager gymId={selectedGymId} gymName={selectedGym.name} />
            </TabsContent>

            <TabsContent value="affected">
              <AffectedBookingsDashboard gymId={selectedGymId} gymName={selectedGym.name} />
            </TabsContent>
          </Tabs>
        )}

        {!selectedGymId && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/50">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a gym to manage its schedule</p>
          </div>
        )}
          </TabsContent>

          <TabsContent value="hotel" className="space-y-6 mt-4">
            <div className="max-w-sm">
              <Label htmlFor="hotel-select">Select Hotel</Label>
              <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                <SelectTrigger id="hotel-select" className="mt-1">
                  <SelectValue placeholder="Choose a hotel to manage" />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((hotel: any) => (
                    <SelectItem key={hotel.id} value={hotel.id}>
                      {hotel.name} {hotel.cities?.name ? `(${hotel.cities.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedHotelId && selectedHotel ? (
              <HotelScheduleManager hotelId={selectedHotelId} hotelName={selectedHotel.name} />
            ) : (
              <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/50">
                <HotelIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a hotel to manage its schedule</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
