import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Eye,
  FileText,
  Users,
  CheckCircle,
  AlertCircle,
  Trophy,
} from "lucide-react";
import { useVerseAnalyticsOverview } from "@/modules/bible/hooks/useVerseAnalyticsOverview";
import { useQuizAnalyticsOverview } from "@/modules/quiz/hooks/useQuizAnalyticsOverview";
import { StatCard } from "@/components/common/StatCard";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminDashboardTiles() {
  const { t } = useTranslation("attendance");
  const bible = useVerseAnalyticsOverview();
  const quiz = useQuizAnalyticsOverview();

  const bibleLoading = bible.isPending;
  const quizLoading = quiz.isPending;

  return (
    <div className="space-y-6">
      {/* Bible Engagement */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          {t("dashboard.tiles.bibleEngagement")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {bibleLoading &&
            [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          {bible.data && (
            <>
              <StatCard
                icon={FileText}
                label={t("dashboard.tiles.totalPosts")}
                value={bible.data.total_posts}
              />
              <StatCard
                icon={BookOpen}
                label={t("dashboard.tiles.published")}
                value={bible.data.published}
                tone="success"
              />
              <StatCard
                icon={Eye}
                label={t("dashboard.tiles.totalOpens")}
                value={bible.data.total_opens}
              />
              <StatCard
                icon={Users}
                label={t("dashboard.tiles.totalReaders")}
                value={bible.data.total_reads}
                hint={`${t("dashboard.tiles.readRate")}: ${bible.data.read_rate.toFixed(1)}%`}
                tone="success"
              />
            </>
          )}
        </div>
      </section>

      {/* Quiz Analytics */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          {t("dashboard.tiles.quizAnalytics")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quizLoading &&
            [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px] rounded-xl" />
            ))}
          {quiz.data && (
            <>
              <StatCard
                icon={FileText}
                label={t("dashboard.tiles.totalQuizzes")}
                value={quiz.data.total_quizzes}
              />
              <StatCard
                icon={CheckCircle}
                label={t("dashboard.tiles.publishedQuizzes")}
                value={quiz.data.published_quizzes}
                tone="success"
              />
              <StatCard
                icon={Users}
                label={t("dashboard.tiles.participants")}
                value={quiz.data.participants}
              />
              <StatCard
                icon={Trophy}
                label={t("dashboard.tiles.avgScore")}
                value={`${quiz.data.average_score.toFixed(1)}%`}
                hint={`${quiz.data.completed} ${t("dashboard.tiles.completed")}`}
                tone="success"
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
