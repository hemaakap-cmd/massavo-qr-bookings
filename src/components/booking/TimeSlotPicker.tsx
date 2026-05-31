import { useState } from "react";
import { useTranslation } from "react-i18next";

interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSelect: (slotId: string) => void;
}

const TimeSlotPicker = ({ slots, selectedSlot, onSelect }: TimeSlotPickerProps) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const getDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const dates = getDates();

  return (
    <div className="space-y-8">
      <h3 className="font-display text-2xl font-bold text-foreground tracking-tight">
        {t("scheduleSlots.pickDateTime")}
      </h3>

      {/* Date Selector */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-2 px-2">
        {dates.map((date, index) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <button
              key={index}
              onClick={() => setSelectedDate(date)}
              className={`flex flex-col items-center px-5 py-4 rounded-xl border-2 min-w-[90px] transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border hover:border-primary/50 bg-card hover:bg-secondary/50"
              }`}
            >
              <span className="font-body text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {date.toLocaleDateString("de-DE", { weekday: "short" })}
              </span>
              <span className="font-display text-2xl font-bold text-foreground mt-1">
                {date.getDate()}
              </span>
              {isToday && (
                <span className="font-body text-xs text-primary font-semibold mt-1">Heute</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Time Slots */}
      <div>
        <p className="font-body text-sm text-muted-foreground mb-4 font-medium">Verfügbare Zeiten</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => slot.available && onSelect(slot.id)}
              disabled={!slot.available}
              className={`py-4 px-4 rounded-xl font-display text-base font-semibold transition-all duration-200 ${
                selectedSlot === slot.id
                  ? "bg-primary text-primary-foreground shadow-lg scale-105"
                  : slot.available
                  ? "bg-secondary/80 text-foreground hover:bg-primary/20 hover:text-primary border border-border hover:border-primary/30"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-40"
              }`}
            >
              {slot.time}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TimeSlotPicker;
