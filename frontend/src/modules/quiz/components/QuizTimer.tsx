import { useTranslation } from "react-i18next";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizTimerProps {
  secondsLeft: number;
  isWarning: boolean;
  isExpired: boolean;
}

export function QuizTimer({
  secondsLeft,
  isWarning,
  isExpired,
}: QuizTimerProps) {
  const formatted = `${String(Math.floor(Math.max(0, secondsLeft) / 60)).padStart(2, "0")}:${String(Math.max(0, secondsLeft) % 60).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium tabular-nums",
        isExpired &&
          "border-brand-red/50 bg-brand-red/10 text-brand-red dark:bg-navy/90 dark:text-brand-red",
        isWarning &&
          !isExpired &&
          "border-brand-orange/50 bg-brand-orange/10 text-brand-orange dark:bg-navy/90 dark:text-brand-orange",
        !isWarning &&
          !isExpired &&
          "border-border bg-muted text-muted-foreground",
      )}
      aria-label={formatted}
    >
      <Timer className="h-4 w-4 shrink-0" />
      <span>{formatted}</span>
    </div>
  );
}
