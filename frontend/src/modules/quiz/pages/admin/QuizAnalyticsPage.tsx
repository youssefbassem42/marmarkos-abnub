import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  CheckCircle2,
  ListChecks,
  Trophy,
  Users,
} from "lucide-react";

import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useQuizAnalyticsOverview } from "../../hooks/useQuizAnalyticsOverview";

/**
 * The quiz analytics dashboard.
 *
 * It shows the aggregate numbers of the overview endpoint
 * (`GET /api/v1/quizzes/analytics/overview`) and links to the monthly
 * analytics, which carry the per-member detail.
 */
export default function QuizAnalyticsPage() {
  const { t } = useTranslation("quiz");
  const { t: tAdmin } = useTranslation("admin");
  const overview = useQuizAnalyticsOverview();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <AdminTopbar
        title={t("admin.analytics.title")}
        subtitle={t("admin.analytics.subtitle")}
      />

      {overview.isError ? (
        <ErrorRetry onRetry={() => void overview.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overview.isPending ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))
          ) : (
            <>
              <StatCard
                icon={ListChecks}
                label={t("admin.analytics.totalQuizzes")}
                value={overview.data?.total_quizzes ?? 0}
              />
              <StatCard
                icon={CheckCircle2}
                label={t("admin.analytics.publishedQuizzes")}
                value={overview.data?.published_quizzes ?? 0}
              />
              <StatCard
                icon={Users}
                label={t("admin.analytics.participants")}
                value={overview.data?.participants ?? 0}
              />
              <StatCard
                icon={CheckCircle2}
                label={t("admin.analytics.completed")}
                value={overview.data?.completed ?? 0}
              />
              <StatCard
                icon={Trophy}
                label={t("admin.analytics.avgScore")}
                value={(overview.data?.average_score ?? 0).toFixed(1)}
              />
              <StatCard
                icon={BarChart3}
                label={t("admin.analytics.totalAttempts")}
                value={
                  (overview.data?.completed ?? 0) +
                  (overview.data?.auto_finished ?? 0)
                }
              />
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {tAdmin("nav.monthlyAnalytics")}
        </p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/admin/analytics/monthly">
            {tAdmin("nav.monthlyAnalytics")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
