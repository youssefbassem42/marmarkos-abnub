import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, QrCode, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { useMeetingAttendance } from "../hooks/useMeetingAttendance";
import { Skeleton } from "@/components/ui/skeleton";

/** Last five check-ins of the open meeting; secondary line is role • time. */
export function RecentCheckInsCard() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const { data, isPending, isError, refetch } = useMeetingAttendance();

  const recent = [...(data?.attendance_records ?? [])]
    .sort(
      (a, b) =>
        new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime(),
    )
    .slice(0, 5);

  return (
    <section
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
      className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)]"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2
          className={cn(
            "font-heading text-lg font-bold text-ink",
            isArabic && "font-arabic",
          )}
        >
          {t("checkIn.recent.title")}
        </h2>
        <Link
          to="/attendance/history"
          className="focus-ring shrink-0 rounded-sm text-sm font-semibold text-brand-blue underline-offset-4 hover:underline"
        >
          {t("checkIn.recent.viewAll")}
        </Link>
      </header>

      {isPending && (
        <ul className="mt-4 space-y-3">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Skeleton className="h-12 rounded-xl" />
            </li>
          ))}
        </ul>
      )}

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

      {!isPending && !isError && recent.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-3 pb-2 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
            <QrCode className="h-8 w-8 text-mint" aria-hidden="true" />
          </span>
          <p
            className={cn(
              "text-sm text-muted-foreground",
              isArabic && "font-arabic text-base",
            )}
          >
            {t("checkIn.recent.empty")}
          </p>
        </div>
      )}

      {!isPending && !isError && recent.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {recent.map((record) => (
            <li
              key={record.id}
              className="recent-row flex items-center gap-3 py-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-navy text-sm font-bold text-white">
                {record.user_name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold text-ink",
                    isArabic && "font-arabic",
                  )}
                >
                  {record.user_name}
                </p>
                {/* §1.4: secondary line is role • time — never a group name. */}
                <p className="truncate text-xs text-muted-foreground">
                  {t("checkIn.recent.role")}
                  {" • "}
                  {new Intl.DateTimeFormat(locale, {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(record.check_in_at))}
                </p>
              </div>
              {record.status === "LATE" ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-status-late/30 bg-status-late/10 px-2.5 py-1 text-xs font-semibold text-status-late">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("status.LATE")}
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-mint/40 bg-mint/15 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("checkIn.recent.badge")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
