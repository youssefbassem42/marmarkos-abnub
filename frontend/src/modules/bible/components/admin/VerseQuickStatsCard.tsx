import { useTranslation } from "react-i18next";
import { BarChart3, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useVerseQuickStats } from "../../hooks/useVerseQuickStats";

const LOCALE = "ar-EG";

/** Admin Quick-Stat sidebar card backed by the real analytics endpoint. */
export function VerseQuickStatsCard() {
  const { t } = useTranslation("bible");
  const { data, isPending, isError } = useVerseQuickStats();

  const fmt = (value: number) => new Intl.NumberFormat(LOCALE).format(value);
  const empty = !isPending && !isError && (!data || data.top_verse_reference === null);

  if (isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-blue" />
          <h3 className="font-bold font-arabic">{t("admin.quickStats.title")}</h3>
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-blue" />
          <h3 className="font-bold font-arabic">{t("admin.quickStats.title")}</h3>
        </div>
        <p className="text-sm text-muted-foreground font-arabic">
          {t("admin.quickStats.empty")}
        </p>
      </div>
    );
  }

  const topVerseLabel =
    data.top_verse_reference && data.top_verse_opens !== null
      ? `${data.top_verse_reference} (${fmt(data.top_verse_opens)} مرة)`
      : null;

  const rows = [
    { label: t("admin.quickStats.thisWeek"), value: fmt(data.this_week) },
    { label: t("admin.quickStats.thisMonth"), value: fmt(data.this_month) },
    { label: t("admin.quickStats.avgReads"), value: fmt(data.avg_reads) },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-brand-blue" />
        <h3 className="font-bold font-arabic">{t("admin.quickStats.title")}</h3>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground font-arabic">
          {t("admin.quickStats.empty")}
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between">
              <span className="text-muted-foreground font-arabic">
                {row.label}
              </span>
              <span className="font-bold" dir="ltr">
                {row.value}
              </span>
            </li>
          ))}
          {topVerseLabel && (
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground font-arabic">
                {t("admin.quickStats.topVerse")}
              </span>
              <span className="flex items-center gap-1 font-bold font-arabic">
                <Trophy className="h-3.5 w-3.5 text-brand-blue" />
                {topVerseLabel}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}