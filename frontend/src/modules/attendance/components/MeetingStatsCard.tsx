import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Clock,
  RefreshCw,
  UserRoundX,
  Users,
} from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { StatTile } from "./StatTile";
import { useMeetingStatistics } from "../hooks/useMeetingStatistics";
import { Skeleton } from "@/components/ui/skeleton";

/** "Current Meeting" card: 4 tiles + view-all link (design §1.4 labels). */
export function MeetingStatsCard() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const { data, isPending, isError, refetch } = useMeetingStatistics();

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)]"
    >
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2
            className={cn(
              "block font-heading text-lg font-bold text-ink",
              isArabic && "font-arabic",
            )}
          >
            {t("checkIn.stats.title")}
          </h2>
          {data && (
            <p
              className={cn(
                "mt-0.5 block text-xs text-muted-foreground",
                isArabic && "font-arabic",
              )}
            >
              {new Intl.DateTimeFormat(locale, {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date(data.meeting_date))}
            </p>
          )}
        </div>
        <Link
          to="/attendance/dashboard"
          className="focus-ring shrink-0 rounded-sm text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
        >
          {t("checkIn.stats.viewAll")}
        </Link>
      </header>

      {isPending && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[104px] rounded-xl" />
          ))}
        </div>
      )}

      {/* Never show zeros on failure — zeros would be a lie (TASK-305 #5). */}
      {isError && (
        <button
          type="button"
          onClick={() => void refetch()}
          className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {tCommon("retry")}
        </button>
      )}

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            Icon={Users}
            iconClassName="text-mint"
            value={data.summary.total_present}
            label={t("checkIn.stats.checkedIn")}
          />
          <StatTile
            Icon={Clock}
            iconClassName="text-status-late"
            value={data.summary.total_late}
            label={t("checkIn.stats.late")}
          />
          <StatTile
            Icon={UserRoundX}
            iconClassName={
              data.summary.is_final
                ? "text-status-absent"
                : "text-muted-foreground"
            }
            value={data.summary.total_absent}
            label={
              data.summary.is_final
                ? t("checkIn.stats.absent")
                : t("checkIn.stats.pending")
            }
            title={
              data.summary.is_final
                ? undefined
                : t("dashboard.absent.provisional")
            }
          />
          <StatTile
            Icon={CalendarDays}
            iconClassName="text-brand-blue"
            value={data.summary.total_expected}
            label={t("checkIn.stats.total")}
          />
        </div>
      )}
    </section>
  );
}
