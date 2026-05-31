export type ReportType = 'daily_booking' | 'weekly_booking' | 'monthly_booking' | 'therapist_summary' | 'gym_commission' | 'admin_overview';
export type RecipientType = 'therapist' | 'gym' | 'admin';
export type DeliveryMethod = 'email' | 'whatsapp' | 'both';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'resent';

export interface GymContact {
  id: string;
  gym_id: string;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  deputy_manager_name: string | null;
  deputy_manager_email: string | null;
  deputy_manager_phone: string | null;
  preferred_delivery_channel: DeliveryMethod;
  notes: string | null;
  created_at: string;
  updated_at: string;
  gyms?: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
  };
}

export interface ReportTemplate {
  id: string;
  name: string;
  report_type: ReportType;
  recipient_type: RecipientType;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TherapistReportData {
  therapist_name: string;
  date_range: string;
  bookings: {
    client_name: string;
    date: string;
    time: string;
    service_name: string;
    gym_name: string;
  }[];
  total_sessions: number;
}

export interface GymReportData {
  gym_name: string;
  date_range: string;
  commission_percentage: number;
  bookings: {
    masked_customer: string;
    date: string;
    time: string;
    service_name: string;
    session_price: number;
    commission_amount: number;
  }[];
  total_sessions: number;
  total_commission: number;
}

export interface AdminReportData {
  date_range: string;
  total_revenue: number;
  total_commission: number;
  total_net: number;
  total_sessions: number;
  gyms: {
    name: string;
    sessions: number;
    revenue: number;
    commission: number;
  }[];
  therapists: {
    name: string;
    sessions: number;
  }[];
}

export interface GeneratedReport {
  id: string;
  template_id: string | null;
  report_type: ReportType;
  recipient_type: RecipientType;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  date_from: string;
  date_to: string;
  report_data: TherapistReportData | GymReportData | AdminReportData;
  generated_by: string | null;
  created_at: string;
  report_templates?: ReportTemplate;
}

export interface ReportDeliveryLog {
  id: string;
  report_id: string;
  delivery_channel: DeliveryMethod;
  recipient_email: string | null;
  recipient_phone: string | null;
  delivery_status: DeliveryStatus;
  sent_by: string | null;
  sent_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  generated_reports?: GeneratedReport;
}

export interface ReportGenerationParams {
  report_type: ReportType;
  recipient_type: RecipientType;
  recipient_id?: string;
  date_from: string;
  date_to: string;
}
