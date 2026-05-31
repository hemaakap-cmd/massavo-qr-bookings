export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type RescheduleStatus = 'pending' | 'confirmed' | 'declined' | 'auto_confirmed' | 'auto_cancelled';

export interface GymSchedule {
  id: string;
  gym_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  max_hours_per_day: number;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotelSchedule {
  id: string;
  hotel_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  max_hours_per_day: number;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleException {
  id: string;
  gym_id: string;
  exception_date: string;
  is_disabled: boolean;
  reason: string | null;
  alternative_date: string | null;
  auto_action: 'suggest_alternative' | 'auto_cancel';
  response_deadline_hours: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingReschedule {
  id: string;
  booking_id: string;
  exception_id: string;
  original_date: string;
  original_time: string;
  suggested_date: string | null;
  suggested_time: string | null;
  selected_date: string | null;
  selected_time: string | null;
  status: RescheduleStatus;
  response_deadline: string;
  customer_notified_at: string | null;
  customer_responded_at: string | null;
  auto_processed_at: string | null;
  reschedule_token: string;
  created_at: string;
  updated_at: string;
  // Joined data
  booking?: {
    id: string;
    customer_name: string | null;
    customer_email: string;
    client_phone: string | null;
    service_id: string;
    gym_id: string;
  };
  exception?: ScheduleException;
}

export interface RescheduleNotification {
  id: string;
  reschedule_id: string;
  notification_type: 'initial' | 'reminder' | 'confirmation' | 'cancellation';
  delivery_channel: 'email' | 'whatsapp' | 'both';
  recipient_email: string | null;
  recipient_phone: string | null;
  sent_at: string | null;
  delivery_status: 'pending' | 'sent' | 'failed' | 'resent';
  error_message: string | null;
  created_at: string;
}

export interface AvailableDate {
  available_date: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  max_hours: number;
  slot_duration: number;
  is_exception: boolean;
  exception_reason: string | null;
}

export const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};
