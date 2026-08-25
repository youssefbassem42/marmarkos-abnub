import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { MessageStatusValue } from "../types";

const STATUS_STYLES = {
  SENT: {
    Icon: CheckCircle2,
    className: "bg-mint/15 text-ink border-mint/40",
  },
  PENDING: {
    Icon: Clock3,
    className: "bg-brand-orange/10 text-status-late border-status-late/30",
  },
  FAILED: {
    Icon: XCircle,
    className: "bg-brand-red/5 text-status-absent border-status-absent/30",
  },
} as const;

interface MessageStatusBadgeProps {
  status: MessageStatusValue;
  className?: string;
}

/** PENDING/SENT/FAILED badge in the attendance badge idiom — never colour-only. */
export function MessageStatusBadge({
  status,
  className,
}: MessageStatusBadgeProps) {
  const { t } = useTranslation("anonymousMessages");
  const { Icon, className: style } = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        style,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {t(`admin.status.${status}`)}
    </span>
  );
}
