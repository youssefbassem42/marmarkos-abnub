import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ListFilter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { TimeRange } from "./timeRange";

const RANGES: {
  value: TimeRange;
  labelKey:
    "filter.allTime" | "filter.today" | "filter.last7" | "filter.last30";
}[] = [
  { value: "allTime", labelKey: "filter.allTime" },
  { value: "today", labelKey: "filter.today" },
  { value: "last7", labelKey: "filter.last7" },
  { value: "last30", labelKey: "filter.last30" },
];

interface NotificationFilterMenuProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

/**
 * The design's "Filter ▾" control — a time-range filter (D-24), not a
 * second type filter: the tabs already cover type grouping.
 */
export function NotificationFilterMenu({
  value,
  onChange,
}: NotificationFilterMenuProps) {
  const { t } = useTranslation("notifications");
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-secondary"
        >
          <ListFilter className="size-4" aria-hidden="true" />
          {t(`filter.${value}`)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {RANGES.map(({ value: rangeValue, labelKey }) => (
          <DropdownMenuItem
            key={rangeValue}
            onClick={() => {
              onChange(rangeValue);
              setOpen(false);
            }}
            className={cn("cursor-pointer justify-between")}
          >
            {t(labelKey)}
            {value === rangeValue && (
              <Check className="size-4 text-mint" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
