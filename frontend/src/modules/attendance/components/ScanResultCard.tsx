import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { AttendanceStatusBadge } from "./AttendanceStatusBadge";
import { useLanguage } from "@/i18n/context";
import type { AttendanceRecord } from "../types";
import { cn } from "@/lib/utils";

export type ScanResultVariant = "success" | "warning" | "error";

interface ScanResultCardProps {
  variant: ScanResultVariant;
  title: string;
  /** Present for success: the recorded attendance. */
  record?: AttendanceRecord;
  onScanNext?: () => void;
}

const VARIANT_STYLES = {
  success: {
    Icon: CheckCircle2,
    iconClass: "text-mint",
    boxClass: "bg-mint/10 border-mint/40",
    titleClass: "text-ink",
  },
  warning: {
    Icon: AlertCircle,
    iconClass: "text-status-late",
    boxClass: "bg-status-late/10 border-status-late/30",
    titleClass: "text-status-late",
  },
  error: {
    Icon: XCircle,
    iconClass: "text-status-absent",
    boxClass: "bg-brand-red/5 border-status-absent/30",
    titleClass: "text-status-absent",
  },
} as const;

/** Result card for success / duplicate / invalid / forbidden / network states. */
export function ScanResultCard({
  variant,
  title,
  record,
  onScanNext,
}: ScanResultCardProps) {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const { Icon, iconClass, boxClass, titleClass } = VARIANT_STYLES[variant];

  return (
    <div
      role={variant === "success" ? "status" : "alert"}
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className={cn("rounded-2xl border p-5", boxClass)}
    >
      <div className="flex items-start gap-4">
        <Icon
          className={cn("h-10 w-10 shrink-0", iconClass)}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <h2 className={cn("font-heading text-lg font-bold", titleClass)}>
            {title}
          </h2>

          {record && (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground">
                  {t("checkIn.result.name")}:
                </dt>
                <dd
                  className={cn(
                    "font-heading text-xl font-bold text-ink",
                    isArabic && "font-arabic",
                  )}
                >
                  {record.user_name}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-muted-foreground">
                  {t("checkIn.result.meeting")}:
                </dt>
                <dd className="text-ink">
                  {new Intl.DateTimeFormat(locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(record.meeting_date))}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 font-medium text-muted-foreground">
                  {t("checkIn.result.time")}:
                </dt>
                <dd className="text-ink">
                  {new Intl.DateTimeFormat(locale, {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(record.check_in_at))}
                </dd>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <dt className="font-medium text-muted-foreground">
                  {t("checkIn.result.status")}:
                </dt>
                <dd>
                  <AttendanceStatusBadge status={record.status} />
                </dd>
              </div>
            </dl>
          )}

          {onScanNext && (
            <button
              type="button"
              onClick={onScanNext}
              className="btn-primary mt-4 px-5 py-2 text-sm"
            >
              <span className={isArabic ? "font-arabic" : undefined}>
                {t("checkIn.result.scanNext")}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
