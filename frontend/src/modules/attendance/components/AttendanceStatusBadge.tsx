import { CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AttendanceStatusValue } from "../types";

const STATUS_STYLES = {
  PRESENT: {
    Icon: CheckCircle2,
    className: "bg-mint/15 text-emerald-700 border-mint/40",
  },
  LATE: {
    Icon: Clock,
    className: "bg-brand-orange/10 text-status-late border-status-late/30",
  },
  ABSENT: {
    Icon: XCircle,
    className: "bg-brand-red/5 text-status-absent border-status-absent/30",
  },
  EXCUSED: {
    Icon: MinusCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
} as const;

interface AttendanceStatusBadgeProps {
  status: AttendanceStatusValue;
  className?: string;
}

/** Shared PRESENT/LATE/ABSENT/EXCUSED badge — never colour-only. */
export function AttendanceStatusBadge({
  status,
  className,
}: AttendanceStatusBadgeProps) {
  const { t } = useTranslation("attendance");
  const { Icon, className: style } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t(`status.${status}`)}
    </span>
  );
}
