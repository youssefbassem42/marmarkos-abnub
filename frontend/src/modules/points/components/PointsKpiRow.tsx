import { useTranslation } from "react-i18next";
import { Award, CalendarDays, CalendarRange } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { PointsResponse } from "../types";

interface PointsKpiRowProps {
  data: PointsResponse | undefined;
  isPending: boolean;
}

export function PointsKpiRow({ data, isPending }: PointsKpiRowProps) {
  const { t } = useTranslation("points");

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        icon={Award}
        iconClassName="text-amber-600"
        label={t("page.lifetime")}
        value={data?.total_points ?? 0}
      />
      <StatCard
        icon={CalendarDays}
        iconClassName="text-emerald-600"
        label={t("page.thisMonth")}
        value={data?.this_month_points ?? 0}
      />
      <StatCard
        icon={CalendarRange}
        iconClassName="text-sky-600"
        label={t("page.thisWeek")}
        value={data?.this_week_points ?? 0}
      />
    </div>
  );
}
