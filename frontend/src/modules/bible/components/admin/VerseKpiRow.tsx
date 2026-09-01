import { useTranslation } from "react-i18next";
import { BookOpen, FileText, Clock, CheckCircle } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useVerseStats } from "../../hooks";

export function VerseKpiRow() {
  const { t } = useTranslation("bible");
  const { data: stats, isLoading } = useVerseStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={BookOpen}
        label={t("admin.kpi.total")}
        value={stats?.total ?? 0}
        tone="default"
      />
      <StatCard
        icon={FileText}
        label={t("admin.kpi.drafts")}
        value={stats?.drafts ?? 0}
        tone="default"
      />
      <StatCard
        icon={Clock}
        label={t("admin.kpi.scheduled")}
        value={stats?.scheduled ?? 0}
        tone="warning"
      />
      <StatCard
        icon={CheckCircle}
        label={t("admin.kpi.published")}
        value={stats?.published ?? 0}
        tone="success"
      />
    </div>
  );
}
