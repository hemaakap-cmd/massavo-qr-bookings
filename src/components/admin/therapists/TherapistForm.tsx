import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TherapistFormData, professionLabels, ProfessionType } from "@/types/therapist";
import { TherapistGymAssignments } from "./TherapistGymAssignments";
import { VenueAssignments } from "./VenueAssignments";
import { MapPin, X } from "lucide-react";
import { useMemo } from "react";

interface Gym {
  id: string;
  name: string;
  city_id?: string;
}

interface City {
  id: string;
  name: string;
}

interface TherapistFormProps {
  formData: TherapistFormData;
  onFormChange: (data: TherapistFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  gyms: Gym[];
  cities: City[];
  isEditing: boolean;
  therapistId?: string;
}

export function TherapistForm({
  formData,
  onFormChange,
  onSubmit,
  gyms,
  cities,
  isEditing,
  therapistId,
}: TherapistFormProps) {
  // Filter gyms by serviceable cities
  const filteredGyms = useMemo(() => {
    if (formData.serviceable_city_ids.length === 0) return gyms;
    return gyms.filter((g) => g.city_id && formData.serviceable_city_ids.includes(g.city_id));
  }, [gyms, formData.serviceable_city_ids]);

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Basic Information */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Basic Information</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profession">Profession *</Label>
            <Select
              value={formData.profession}
              onValueChange={(value: ProfessionType) => onFormChange({ ...formData, profession: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select profession" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(professionLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Select
              value={formData.gender}
              onValueChange={(value: "male" | "female") => onFormChange({ ...formData, gender: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => onFormChange({ ...formData, phone: e.target.value })}
              placeholder="+49 123 456789"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
              placeholder="therapist@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="specialty">Specialty</Label>
          <Input
            id="specialty"
            value={formData.specialty}
            onChange={(e) => onFormChange({ ...formData, specialty: e.target.value })}
            placeholder="Sports & Deep Tissue"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="education">Education / Certification</Label>
          <Input
            id="education"
            value={formData.education}
            onChange={(e) => onFormChange({ ...formData, education: e.target.value })}
            placeholder="Certified Massage Therapist, Physiotherapy Degree"
          />
        </div>
      </div>

      {/* Serviceable Cities */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Serviceable Cities (Einsatzgebiete)
        </h4>
        <p className="text-xs text-muted-foreground">
          Select the cities where this therapist can work. Only gyms in selected cities will be available for assignment below.
        </p>

        <div className="flex flex-wrap gap-2">
          {formData.serviceable_city_ids.map((cityId) => {
            const city = cities.find((c) => c.id === cityId);
            return city ? (
              <Badge key={cityId} variant="secondary" className="gap-1 pr-1">
                <MapPin className="w-3 h-3" />
                {city.name}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive/20 rounded-full"
                  onClick={() => {
                    const updated = formData.serviceable_city_ids.filter((id) => id !== cityId);
                    onFormChange({ ...formData, serviceable_city_ids: updated });
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ) : null;
          })}
        </div>

        <Select
          onValueChange={(cityId) => {
            if (!formData.serviceable_city_ids.includes(cityId)) {
              onFormChange({
                ...formData,
                serviceable_city_ids: [...formData.serviceable_city_ids, cityId],
              });
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Add city..." />
          </SelectTrigger>
          <SelectContent>
            {cities
              .filter((c) => !formData.serviceable_city_ids.includes(c.id))
              .map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Gym Assignments & Schedules — filtered by serviceable cities */}
      <TherapistGymAssignments
        assignments={formData.gym_assignments}
        onChange={(gym_assignments) => {
          const primaryGym = gym_assignments.find((a) => a.is_primary);
          onFormChange({
            ...formData,
            gym_assignments,
            gym_id: primaryGym?.gym_id || formData.gym_id,
          });
        }}
        gyms={filteredGyms}
      />

      {/* Personal Location */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Personal Location</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city_id">Home City</Label>
            <Select
              value={formData.city_id}
              onValueChange={(value) => onFormChange({ ...formData, city_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => onFormChange({ ...formData, address: e.target.value })}
              placeholder="Street, City, ZIP"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude (GPS)</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => onFormChange({ ...formData, latitude: e.target.value })}
              placeholder="50.9375"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude (GPS)</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => onFormChange({ ...formData, longitude: e.target.value })}
              placeholder="6.9603"
            />
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Additional Info</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rating">Rating (0-5)</Label>
            <Input
              id="rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => onFormChange({ ...formData, rating: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image_url">Profile Image URL</Label>
            <Input
              id="image_url"
              value={formData.image_url}
              onChange={(e) => onFormChange({ ...formData, image_url: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
            placeholder="Additional notes about the therapist..."
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="is_available"
            checked={formData.is_available}
            onCheckedChange={(checked) => onFormChange({ ...formData, is_available: checked })}
          />
          <Label htmlFor="is_available">Available for bookings</Label>
        </div>
      </div>

      <Button type="submit" variant="sage" className="w-full">
        {isEditing ? "Update Therapist" : "Create Therapist"}
      </Button>

      {isEditing && therapistId && (
        <VenueAssignments therapistId={therapistId} />
      )}
    </form>
  );
}
