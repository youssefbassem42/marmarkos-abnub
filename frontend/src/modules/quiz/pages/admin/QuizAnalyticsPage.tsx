import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  ListChecks,
  RefreshCw,
  Timer,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsvRows } from "@/lib/csv";

import { quizApi } from "../../api";
import { useAdminQuizzes } from "../../hooks/useAdminQuizzes";
import { useQuizAnalytics } from "../../hooks/useQuizAnalytics";
import { useQuizAnalyticsOverview } from "../../hooks/useQuizAnalyticsOverview";
import { useQuizAnalyticsUsers } from "../../hooks/useQuizAnalyticsUsers";
import type { AttemptStatus, QuizAdminItem, QuizStatus } from "../../types";

const ANALYTICS_PATH = "/admin/analytics/quizzes";
const LOCALE = "ar-EG";
const PAGE_SIZE = 20;

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 1,
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function quizStatusVariant(
  status: QuizStatus,
): "default" | "secondary" | "outline" {
  if (status === "PUBLISHED") return "default";
  if (status === "DRAFT") return "secondary";
  return "outline";
}

function completionColor(status: AttemptStatus): string {
  if (status === "COMPLETED") return "var(--chart-1)";
  if (status === "AUTO_FINISHED") return "var(--chart-3)";
  return "var(--chart-5)";
}

function QuizAnalyticsListRow({
  quiz,
  href,
}: {
  quiz: QuizAdminItem;
  href: string;
}) {
  const { t } = useTranslation("quiz");
  const analytics = useQuizAnalytics(quiz.id);
  const accessibleAction = t("admin.analytics.viewAnalysisFor", {
    title: quiz.title,
  });

  return (
    <TableRow>
      <TableCell>
        <Link
          to={href}
          aria-label={accessibleAction}
          className="focus-ring rounded-sm font-medium text-ink hover:text-brand-blue"
        >
          {quiz.title}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant={quizStatusVariant(quiz.status)}>
          {t(`admin.list.statuses.${quiz.status}`)}
        </Badge>
      </TableCell>
      <TableCell>
        {analytics.isPending ? (
          <Skeleton className="h-5 w-12" />
        ) : analytics.isError ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void analytics.refetch()}
            aria-label={t("admin.analytics.retryMetric", {
              title: quiz.title,
            })}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("admin.analytics.retry")}
          </Button>
        ) : (
          formatNumber(analytics.data?.participants ?? 0)
        )}
      </TableCell>
      <TableCell>
        {analytics.isPending ? (
          <Skeleton className="h-5 w-12" />
        ) : analytics.isError ? (
          <span className="text-sm text-muted-foreground">
            {t("admin.analytics.notAvailable")}
          </span>
        ) : (
          t("admin.analytics.scoreOutOfTen", {
            value: formatNumber(analytics.data?.average_score_out_of_10 ?? 0),
          })
        )}
      </TableCell>
      <TableCell>
        <Button asChild size="sm" variant="outline">
          <Link to={href} aria-label={accessibleAction}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {t("admin.analytics.viewAnalysis")}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function QuizAnalyticsList({
  quizzes,
  isPending,
  isError,
  onRetry,
  getQuizHref,
}: {
  quizzes: QuizAdminItem[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  getQuizHref: (quizId: string) => string;
}) {
  const { t } = useTranslation("quiz");

  return (
    <section
      aria-labelledby="quiz-analytics-list-title"
      className="rounded-2xl border border-border bg-card card-elevated"
    >
      <div className="border-b border-border px-5 py-4">
        <h2
          id="quiz-analytics-list-title"
          className="font-heading text-lg font-bold text-ink"
        >
          {t("admin.analytics.listTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.analytics.listSubtitle")}
        </p>
      </div>

      {isError ? (
        <div className="p-4">
          <ErrorRetry onRetry={onRetry} />
        </div>
      ) : isPending ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <EmptyState
          Icon={ListChecks}
          title={t("admin.analytics.noQuizzesTitle")}
          action={
            <p className="max-w-md text-sm text-muted-foreground">
              {t("admin.analytics.noQuizzesBody")}
            </p>
          }
        />
      ) : (
        <Table>
          <TableCaption className="sr-only">
            {t("admin.analytics.listTitle")}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("admin.analytics.colTitle")}</TableHead>
              <TableHead scope="col">
                {t("admin.analytics.colStatus")}
              </TableHead>
              <TableHead scope="col">
                {t("admin.analytics.colAttempts")}
              </TableHead>
              <TableHead scope="col">
                {t("admin.analytics.colAverage")}
              </TableHead>
              <TableHead scope="col" className="text-end">
                {t("admin.analytics.viewAnalysis")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quizzes.map((quiz) => (
              <QuizAnalyticsListRow
                key={quiz.id}
                quiz={quiz}
                href={getQuizHref(quiz.id)}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function QuizAnalyticsDetail({
  quizId,
  quizTitle,
  backHref,
}: {
  quizId: string;
  quizTitle?: string;
  backHref: string;
}) {
  const { t } = useTranslation("quiz");
  const [userPage, setUserPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const analytics = useQuizAnalytics(quizId);
  const users = useQuizAnalyticsUsers(quizId, {
    page: userPage,
    size: PAGE_SIZE,
  });

  const scoreData = useMemo(
    () =>
      (analytics.data?.score_distribution ?? []).map((bucket) => ({
        score: bucket.score,
        users: bucket.users,
      })),
    [analytics.data],
  );

  const completionData = useMemo(
    () =>
      (analytics.data?.completion_status ?? []).map((bucket) => ({
        status: bucket.status,
        users: bucket.users,
        percentage: bucket.percentage,
        color: completionColor(bucket.status),
      })),
    [analytics.data],
  );

  const scoreChartConfig = {
    score: {
      label: t("admin.analytics.colScore"),
      color: "var(--chart-2)",
    },
    users: {
      label: t("admin.analytics.chartUsers"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const completionChartConfig = {
    COMPLETED: {
      label: t("admin.analytics.status.COMPLETED"),
      color: "var(--chart-1)",
    },
    AUTO_FINISHED: {
      label: t("admin.analytics.status.AUTO_FINISHED"),
      color: "var(--chart-3)",
    },
    IN_PROGRESS: {
      label: t("admin.analytics.status.IN_PROGRESS"),
      color: "var(--chart-5)",
    },
  } satisfies ChartConfig;

  const hasAttempts =
    (analytics.data?.participants ?? 0) > 0 || (users.data?.total ?? 0) > 0;

  async function handleExport() {
    setExporting(true);
    try {
      const title = quizTitle ?? (await quizApi.getQuiz(quizId)).title;
      const rows = (users.data?.items ?? []).map((user) => [
        user.full_name,
        formatNumber(user.score),
        formatNumber(user.points_awarded),
        `${formatNumber(user.percentage)}%`,
        t(`admin.analytics.status.${user.status}`),
        t("admin.analytics.duration", {
          minutes: formatNumber(Math.floor(user.time_taken_seconds / 60)),
          seconds: formatNumber(user.time_taken_seconds % 60),
        }),
      ]);

      downloadCsvRows(
        t("admin.analytics.exportFilename", { title }),
        [
          t("admin.analytics.colName"),
          t("admin.analytics.colScore"),
          t("admin.analytics.colPoints"),
          t("admin.analytics.colPercentage"),
          t("admin.analytics.colUserStatus"),
          t("admin.analytics.colTime"),
        ],
        rows,
      );
      toast.success(t("admin.analytics.exportSuccess"));
    } catch {
      toast.error(t("admin.analytics.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section aria-labelledby="quiz-analysis-title" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link to={backHref}>
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            {t("admin.analytics.backToList")}
          </Link>
        </Button>
        <div className="min-w-0">
          <h2
            id="quiz-analysis-title"
            className="font-heading text-xl font-bold text-ink"
          >
            {t("admin.analytics.analysisTitle")}
          </h2>
          {quizTitle ? (
            <p className="truncate text-sm text-muted-foreground">
              {quizTitle}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="ms-auto"
          disabled={exporting || users.isPending || users.isError}
          onClick={() => void handleExport()}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {exporting
            ? t("admin.analytics.exporting")
            : t("admin.analytics.exportButton")}
        </Button>
      </div>

      {analytics.isError || users.isError ? (
        <ErrorRetry
          onRetry={() => {
            void analytics.refetch();
            void users.refetch();
          }}
        />
      ) : analytics.isPending || users.isPending ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : analytics.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Users}
              label={t("admin.analytics.kpiParticipants")}
              value={formatNumber(analytics.data.participants)}
            />
            <StatCard
              icon={CheckCircle2}
              label={t("admin.analytics.kpiCompleted")}
              value={formatNumber(analytics.data.completed)}
            />
            <StatCard
              icon={Timer}
              label={t("admin.analytics.kpiAutoFinished")}
              value={formatNumber(analytics.data.auto_finished)}
            />
            <StatCard
              icon={Trophy}
              label={t("admin.analytics.kpiAverageScore")}
              value={formatNumber(analytics.data.average_score_out_of_10)}
            />
            <StatCard
              icon={TrendingUp}
              label={t("admin.analytics.kpiHighestScore")}
              value={formatNumber(analytics.data.highest_score)}
            />
            <StatCard
              icon={TrendingDown}
              label={t("admin.analytics.kpiLowestScore")}
              value={formatNumber(analytics.data.lowest_score)}
            />
          </div>

          {!hasAttempts ? (
            <div className="rounded-2xl border border-dashed border-border bg-card">
              <EmptyState
                Icon={BarChart3}
                title={t("admin.analytics.emptyTitle")}
                action={
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t("admin.analytics.emptyBody")}
                  </p>
                }
              />
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-border bg-card p-5 card-elevated">
                  <h3 className="font-heading font-bold text-ink">
                    {t("admin.analytics.distributionTitle")}
                  </h3>
                  {scoreData.length === 0 ? (
                    <EmptyState
                      title={t("admin.analytics.noDistribution")}
                      className="p-8"
                    />
                  ) : (
                    <ChartContainer
                      config={scoreChartConfig}
                      className="mt-4 h-[260px] w-full"
                      role="img"
                      aria-label={t("admin.analytics.distributionTitle")}
                    >
                      <BarChart
                        accessibilityLayer
                        data={scoreData}
                        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="score"
                          tickLine={false}
                          axisLine={false}
                          reversed
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          orientation="right"
                          allowDecimals={false}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent labelKey="score" />}
                        />
                        <Bar
                          dataKey="users"
                          fill="var(--color-users)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ChartContainer>
                  )}
                </section>

                <section className="rounded-2xl border border-border bg-card p-5 card-elevated">
                  <h3 className="font-heading font-bold text-ink">
                    {t("admin.analytics.completionTitle")}
                  </h3>
                  {completionData.length === 0 ? (
                    <EmptyState
                      title={t("admin.analytics.noCompletionData")}
                      className="p-8"
                    />
                  ) : (
                    <div className="mt-4 grid items-center gap-4 sm:grid-cols-[220px_1fr]">
                      <ChartContainer
                        config={completionChartConfig}
                        className="h-[220px] w-full"
                        role="img"
                        aria-label={t("admin.analytics.completionTitle")}
                      >
                        <PieChart accessibilityLayer>
                          <Pie
                            data={completionData}
                            dataKey="users"
                            nameKey="status"
                            innerRadius={55}
                            outerRadius={85}
                          >
                            {completionData.map((bucket) => (
                              <Cell key={bucket.status} fill={bucket.color} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                      <ul
                        className="space-y-3"
                        aria-label={t("admin.analytics.completionTitle")}
                      >
                        {completionData.map((bucket) => (
                          <li
                            key={bucket.status}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: bucket.color }}
                              aria-hidden="true"
                            />
                            <span className="font-medium">
                              {t(`admin.analytics.status.${bucket.status}`)}
                            </span>
                            <span className="text-muted-foreground">
                              {t("admin.analytics.completionUsers", {
                                count: bucket.users,
                              })}
                            </span>
                            <span className="ms-auto font-semibold text-ink">
                              {formatNumber(bucket.percentage)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              </div>

              <section className="rounded-2xl border border-border bg-card card-elevated">
                <h3 className="border-b border-border px-5 py-4 font-heading font-bold text-ink">
                  {t("admin.analytics.usersTitle")}
                </h3>
                {users.data && users.data.items.length > 0 ? (
                  <>
                    <Table>
                      <TableCaption className="sr-only">
                        {t("admin.analytics.usersTitle")}
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead scope="col">
                            {t("admin.analytics.colName")}
                          </TableHead>
                          <TableHead scope="col" className="text-end">
                            {t("admin.analytics.colScore")}
                          </TableHead>
                          <TableHead scope="col" className="text-end">
                            {t("admin.analytics.colPoints")}
                          </TableHead>
                          <TableHead scope="col" className="text-end">
                            {t("admin.analytics.colPercentage")}
                          </TableHead>
                          <TableHead scope="col">
                            {t("admin.analytics.colUserStatus")}
                          </TableHead>
                          <TableHead scope="col" className="text-end">
                            {t("admin.analytics.colTime")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.data.items.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell className="font-medium text-ink">
                              {user.full_name}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatNumber(user.score)}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatNumber(user.points_awarded)}
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {formatNumber(user.percentage)}%
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  user.status === "COMPLETED"
                                    ? "default"
                                    : "outline"
                                }
                              >
                                {t(`admin.analytics.status.${user.status}`)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-end tabular-nums">
                              {t("admin.analytics.duration", {
                                minutes: formatNumber(
                                  Math.floor(user.time_taken_seconds / 60),
                                ),
                                seconds: formatNumber(
                                  user.time_taken_seconds % 60,
                                ),
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {users.data.pages > 1 ? (
                      <div className="flex justify-center border-t border-border px-5 py-3">
                        <AppPagination
                          page={users.data.page}
                          pages={users.data.pages}
                          onPageChange={setUserPage}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    Icon={Users}
                    title={t("admin.analytics.emptyTitle")}
                    className="p-8"
                  />
                )}
              </section>
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

/**
 * The quiz analytics dashboard.
 *
 * The overview keeps the aggregate tiles. The list below opens the
 * analysis of one quiz: its KPIs, its score distribution, its completion
 * status and the result of every member.
 */
export default function QuizAnalyticsPage() {
  const { t } = useTranslation("quiz");
  const { t: tAdmin } = useTranslation("admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const overview = useQuizAnalyticsOverview();

  // The quiz management page already links here with `quizId`; the page
  // also uses the shorter `quiz` parameter for its own links. Both open
  // the same analysis so an existing bookmark keeps working.
  const selectedQuizId = searchParams.get("quiz") ?? searchParams.get("quizId");
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const quizzesQuery = useAdminQuizzes({ page, size: PAGE_SIZE });
  const quizzes = quizzesQuery.data?.items ?? [];
  const selectedQuiz = quizzes.find((quiz) => quiz.id === selectedQuizId);

  const listParams = new URLSearchParams();
  if (page > 1) listParams.set("page", String(page));
  const listHref = listParams.size
    ? `${ANALYTICS_PATH}?${listParams.toString()}`
    : ANALYTICS_PATH;

  function openQuizHref(quizId: string): string {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    params.set("quiz", quizId);
    return `${ANALYTICS_PATH}?${params.toString()}`;
  }

  function changeListPage(nextPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    params.delete("quiz");
    setSearchParams(params);
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <AdminTopbar
        title={t("admin.analytics.title")}
        subtitle={t("admin.analytics.subtitle")}
        backHref="/admin/dashboard"
        showSidebarTrigger
      />

      <main className="space-y-6">
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

        {selectedQuizId ? (
          <QuizAnalyticsDetail
            key={selectedQuizId}
            quizId={selectedQuizId}
            quizTitle={selectedQuiz?.title}
            backHref={listHref}
          />
        ) : (
          <>
            <QuizAnalyticsList
              quizzes={quizzes}
              isPending={quizzesQuery.isPending}
              isError={quizzesQuery.isError}
              onRetry={() => void quizzesQuery.refetch()}
              getQuizHref={openQuizHref}
            />
            {quizzesQuery.data && quizzesQuery.data.pages > 1 ? (
              <div className="flex justify-center">
                <AppPagination
                  page={quizzesQuery.data.page}
                  pages={quizzesQuery.data.pages}
                  onPageChange={changeListPage}
                />
              </div>
            ) : null}
          </>
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
      </main>
    </div>
  );
}
