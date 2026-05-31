import {
  CalendarPlus,
  XCircle,
  RefreshCw,
  ShieldAlert,
  CreditCard,
  AlertTriangle,
} from "lucide-react";

interface StatsProps {
  stats: {
    total: number;
    created: number;
    cancelled: number;
    rescheduled: number;
    conflicts: number;
    paymentFailed: number;
    errors: number;
    warnings: number;
  };
}

export function MonitoringStats({ stats }: StatsProps) {
  const cards = [
    {
      label: "Created",
      value: stats.created,
      icon: CalendarPlus,
      bg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-600",
      ring: "ring-emerald-500/20",
    },
    {
      label: "Cancelled",
      value: stats.cancelled,
      icon: XCircle,
      bg: "bg-red-500/10",
      iconColor: "text-red-500",
      valueColor: "text-red-600",
      ring: "ring-red-500/20",
    },
    {
      label: "Rescheduled",
      value: stats.rescheduled,
      icon: RefreshCw,
      bg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      valueColor: "text-blue-600",
      ring: "ring-blue-500/20",
    },
    {
      label: "Conflicts",
      value: stats.conflicts,
      icon: ShieldAlert,
      bg: "bg-orange-500/10",
      iconColor: "text-orange-500",
      valueColor: "text-orange-600",
      ring: "ring-orange-500/20",
    },
    {
      label: "Pay Failed",
      value: stats.paymentFailed,
      icon: CreditCard,
      bg: "bg-rose-500/10",
      iconColor: "text-rose-500",
      valueColor: "text-rose-600",
      ring: "ring-rose-500/20",
    },
    {
      label: "Warnings",
      value: stats.warnings,
      icon: AlertTriangle,
      bg: "bg-amber-500/10",
      iconColor: "text-amber-500",
      valueColor: "text-amber-600",
      ring: "ring-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl ${c.bg} ring-1 ${c.ring} transition-shadow hover:shadow-sm`}
        >
          <c.icon className={`w-4 h-4 ${c.iconColor}`} />
          <span className={`text-xl font-bold tabular-nums ${c.valueColor}`}>
            {c.value}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
