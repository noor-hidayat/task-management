import * as React from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import "react-day-picker/style.css";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const from = value?.from;
  const to = value?.to;

  const displayValue = React.useMemo(() => {
    if (!from && !to) return "";
    if (from && to) return `${format(from, "dd MMM yyyy")} – ${format(to, "dd MMM yyyy")}`;
    if (from) return `${format(from, "dd MMM yyyy")} – ...`;
    return "";
  }, [from, to]);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            readOnly
            placeholder={placeholder}
            value={displayValue}
            onClick={() => setOpen(true)}
            disabled={disabled}
            className={cn("pl-9 pr-9 cursor-pointer", className)}
          />
          <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={clear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={5}>
        <div className="p-3">
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t">
          <Button variant="outline" size="sm" onClick={() => { onChange(undefined); setOpen(false); }}>
            Clear
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} disabled={!from || !to}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}