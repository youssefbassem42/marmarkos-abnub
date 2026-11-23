import { useTranslation } from "react-i18next";
import { CalendarX2, Gauge, ListChecks, Trophy } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { StatCard } from "@/components/common/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonthYear } from "@/lib/datetime";
import type { MonthlyPointsResponse } from "../types";

interface MonthlyPointsSummaryProps {
  data: MonthlyPointsResponse | undefined;
  selectedMonth: string;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

const LOCALE = "ar-EG";

function selectedMonthLabel(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  return formatMonthYear(`${month}-01`, LOCALE);
}

/** The total, the quizzes and the average of the month in the URL. */
export function MonthlyPointsSummary({
  data,
  selectedMonth,
  isPending,
  isError,
  onRetry,
}: MonthlyPointsSummaryProps) {
  const { t } = useTranslation("points");
  const monthLabel = selectedMonthLabel(selectedMonth);
  const month = data?.items.find(
    (item) => item.period_month.slice(0, 7) === selectedMonth,
  );

  return (
    <section
      aria-labelledby="points-month-summary-title"
      className="rounded-2xl border border-border bg-card p-5 card-elevated"
    >
      <h2
        id="points-month-summary-title"
        className="font-heading text-lg font-bold text-ink font-arabic"
      >
        {t("page.month.summary", { month: monthLabel })}
      </h2>

      {isPending ? (
        <div
          role="status"
          aria-label={t("page.month.loading")}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[88px] rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorRetry
          onRetry={onRetry}
          className="mt-4"
          label={t("page.month.error")}
        />
      ) : !month || month.points === 0 ? (
        <EmptyState
          Icon={CalendarX2}
          title={t("page.month.empty")}
          className="p-8"
        />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            icon={Trophy}
            tone="success"
            label={t("page.month.total")}
            value={month.points}
          />
          <StatCard
            icon={ListChecks}
            tone="default"
            label={t("page.month.quizzes")}
            value={month.quizzes_completed}
          />
          <StatCard
            icon={Gauge}
            tone="warning"
            label={t("page.month.average")}
            value={
              month.quizzes_completed > 0
                ? (month.points / month.quizzes_completed).toFixed(1)
                : "0.0"
            }
          />
        </div>
      )}
    </section>
  );
}
