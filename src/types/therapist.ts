export type ProfessionType = 'massage_therapist' | 'physiotherapist' | 'sports_therapist';

export interface Therapist {
  id: string;
  gym_id: string | null; // nullable — primary gym kept for backward compat
  name: string;
  specialty: string | null;
  rating: number;
  image_url: string | null;
  is_available: boolean;
  phone?: string | null;
  email?: string | null;
  city_id: string | null;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  profession: ProfessionType;
  education: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  gyms?: { name: string; address: string; latitude?: number; longitude?: number } | null;
  cities?: { name: string } | null;
  // Multi-gym joined data
  therapist_gyms?: Array<{ gym_id: string; is_primary: boolean; gyms: { id: string; name: string; cities?: { name: string } } }>;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export interface GymDaySchedule {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface GymAssignment {
  gym_id: string;
  gym_name?: string;
  city_name?: string;
  is_primary: boolean;
  schedules: GymDaySchedule[];
}

export interface TherapistFormData {
  gym_id: string; // primary gym (backward compat)
  name: string;
  specialty: string;
  rating: string;
  image_url: string;
  is_available: boolean;
  phone: string;
  email: string;
  city_id: string;
  address: string;
  latitude: string;
  longitude: string;
  profession: ProfessionType;
  education: string;
  notes: string;
  gender: "male" | "female" | "";
  gym_assignments: GymAssignment[];
  serviceable_city_ids: string[];
}

export const createDefaultSchedules = (): GymDaySchedule[] =>
  ALL_DAYS.map((day) => ({
    day_of_week: day,
    start_time: '09:00',
    end_time: '17:00',
    is_active: false,
  }));

export const initialTherapistFormData: TherapistFormData = {
  gym_id: "",
  name: "",
  specialty: "",
  rating: "0",
  image_url: "",
  is_available: true,
  phone: "",
  email: "",
  city_id: "",
  address: "",
  latitude: "",
  longitude: "",
  profession: "massage_therapist",
  education: "",
  notes: "",
  gender: "",
  gym_assignments: [],
  serviceable_city_ids: [],
};

export const professionLabels: Record<ProfessionType, string> = {
  massage_therapist: "Massage Therapist",
  physiotherapist: "Physiotherapist",
  sports_therapist: "Sports Therapist",
};

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
