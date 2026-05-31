import { Eye, MapPin, Globe } from "lucide-react";
import { useVisitorCount, VisitorDetail } from "@/hooks/useVisitorCount";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";

export function LiveVisitorWidget() {
  const { count, connected, visitors } = useVisitorCount();

  // Group visitors by city
  const cityGroups = useMemo(() => {
    const groups: Record<string, { city: string; country: string; count: number; pages: string[] }> = {};
    visitors.forEach((v) => {
      const key = `${v.city}-${v.country}`;
      if (!groups[key]) {
        groups[key] = { city: v.city, country: v.country, count: 0, pages: [] };
      }
      groups[key].count++;
      if (!groups[key].pages.includes(v.page)) {
        groups[key].pages.push(v.page);
      }
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [visitors]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{count}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">online</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground">—</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Live Visitors ({count})
            </span>
          </div>
        </div>
        <ScrollArea className="max-h-64">
          {cityGroups.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No visitors right now
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {cityGroups.map((group) => (
                <div
                  key={`${group.city}-${group.country}`}
                  className="flex items-center justify-between px-2.5 py-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {group.city}
                      </p>
                      {group.country && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {group.country}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    {group.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
