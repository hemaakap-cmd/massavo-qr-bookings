export interface GymCommission {
  id: string;
  name: string;
  commission_percentage: number;
  total_revenue: number;
  total_commission: number;
  booking_count: number;
}

export interface AnonymizedBooking {
  id: string;
  masked_customer: string;
  booking_date: string;
  booking_time: string;
  service_name: string;
  session_price: number;
  gym_name: string;
  gym_id: string;
  commission_percentage: number;
  commission_amount: number;
}

export interface FinancialSummary {
  total_revenue: number;
  total_commission: number;
  total_net: number;
  booking_count: number;
}
