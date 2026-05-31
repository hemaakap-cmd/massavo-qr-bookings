import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, TrendingUp, Building2, Calendar } from "lucide-react";
import type { FinancialSummary } from "@/types/financial";

interface FinancialSummaryCardsProps {
  summary: FinancialSummary;
  gymName?: string;
  currencySymbol?: string;
}

const FinancialSummaryCards = ({ summary, gymName, currencySymbol = "€" }: FinancialSummaryCardsProps) => {
  const fmt = (amount: number) => `${currencySymbol} ${amount.toFixed(2)}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{fmt(summary.total_revenue)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {gymName ? `From ${gymName}` : "All gyms combined"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gym Commission
          </CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{fmt(summary.total_commission)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Payable to gym partner(s)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Revenue
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{fmt(summary.total_net)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            After commission deduction
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Sessions
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.booking_count}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Completed bookings
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialSummaryCards;
