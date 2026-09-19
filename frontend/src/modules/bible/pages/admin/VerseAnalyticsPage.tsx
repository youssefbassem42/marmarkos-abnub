import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  FileBarChart2,
  HeartHandshake,
  Percent,
  Trophy,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useVerseAnalyticsOverview } from "../../hooks/useVerseAnalyticsOverview";
import { useVerseQuickStats } from "../../hooks/useVerseQuickStats";
import { useVerseAnalytics } from "../../hooks/useVerseAnalytics";
import {
  useVerseAnalyticsUsers,
  type VerseAnalyticsUsersParams,
} from "../../hooks/useVerseAnalyticsUsers";
// eslint-disable-next-line boundaries/entry-point
import { VersePickerField } from "@/modules/quiz/components/admin/VersePickerField";

const LOCALE = "ar-EG";

export default function VerseAnalyticsPage() {
  const { t } = useTranslation("bible");
  const { t: tCommon } = useTranslation("common");
  const [verseId, setVerseId] = useState("");
  const [readFilter, setReadFilter] =
    useState<VerseAnalyticsUsersParams["read"]>("all");
  const [page, setPage] = useState(1);

  const overview = useVerseAnalyticsOverview();
  const quick = useVerseQuickStats();
  const detail = useVerseAnalytics(verseId);
  const users = useVerseAnalyticsUsers(verseId, { page, size: 10, read: readFilter });

  useEffect(() => {
    setPage(1);
  }, [verseId, readFilter]);

  const chartData = useMemo(
    () =>
      (detail.data?.series ?? []).map((point) => ({
        label: new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "short" }).format(
          new Date(`${point.bucket}T00:00:00`),
        ),
        opens: point.opens,
        reads: point.reads,
      })),
    [detail.data],
  );

  const chartConfig = {
    opens: { label: t("admin.analytics.series.opens"), color: "var(--brand-blue)" },
    reads: { label: t("admin.analytics.series.reads"), color: "var(--mint)" },
  } satisfies ChartConfig;

  const fmt = (value: number) => new Intl.NumberFormat(LOCALE).format(value);

  const overviewTiles = [
    {
      label: t("admin.analytics.kpi.totalPosts"),
      value: overview.data ? fmt(overview.data.total_posts) : "—",
      Icon: BookOpen,
    },
    {
      label: t("admin.analytics.kpi.published"),
      value: overview.data ? fmt(overview.data.published) : "—",
      Icon: FileBarChart2,
    },
    {
      label: t("admin.analytics.kpi.totalOpens"),
      value: overview.data ? fmt(overview.data.total_opens) : "—",
      Icon: Eye,
    },
    {
      label: t("admin.analytics.kpi.totalReads"),
      value: overview.data ? fmt(overview.data.total_reads) : "—",
      Icon: CheckCircle2,
    },
    {
      label: t("admin.analytics.kpi.readRate"),
      value: overview.data ? `${fmt(overview.data.read_rate)}%` : "—",
      Icon: Percent,
    },
  ];

  const quickTiles = [
    { label: t("admin.analytics.quick.thisWeek"), value: quick.data ? fmt(quick.data.this_week) : "—" },
    { label: t("admin.analytics.quick.thisMonth"), value: quick.data ? fmt(quick.data.this_month) : "—" },
    { label: t("admin.analytics.quick.avgReads"), value: quick.data ? fmt(quick.data.avg_reads) : "—" },
    {
      label: t("admin.analytics.quick.topVerse"),
      value:
        quick.data?.top_verse_reference && quick.data.top_verse_opens !== null
          ? `${quick.data.top_verse_reference} (${fmt(quick.data.top_verse_opens)} مرة)`
          : "—",
      Icon: Trophy,
    },
  ];

  return (
    <div dir="rtl" lang="ar">
      <AdminTopbar title={t("admin.analytics.title")} subtitle={t("admin.analytics.subtitle")} />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/bible-verses">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-arabic">
            {t("admin.analytics.title")}
          </h1>
        </div>

        {/* Overview tiles */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {overviewTiles.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 card-elevated"
            >
              {Icon && <Icon className="h-6 w-6 shrink-0 text-brand-blue" />}
              <div className="min-w-0">
                <p className="font-heading text-2xl font-bold text-ink" dir="ltr">
                  {value}
                </p>
                <p className="truncate text-xs text-muted-foreground font-arabic">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Quick stats tiles */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {quickTiles.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 card-elevated"
            >
              {Icon && <Icon className="h-6 w-6 shrink-0 text-brand-blue" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink font-arabic" dir="auto">
                  {value}
                </p>
                <p className="truncate text-xs text-muted-foreground font-arabic">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* Per-verse analytics */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-md space-y-1.5">
              <label className="text-sm font-medium text-ink font-arabic">
                {t("admin.analytics.selectVerse")}
              </label>
              <VersePickerField value={verseId} onValueChange={setVerseId} />
            </div>
          </div>

          {!verseId && (
            <div className="rounded-2xl border border-dashed border-border bg-card">
              <EmptyState
                Icon={FileBarChart2}
                title={t("admin.analytics.emptyTitle")}
              />
              <p className="-mt-6 pb-10 text-center text-sm text-muted-foreground font-arabic">
                {t("admin.analytics.emptyBody")}
              </p>
            </div>
          )}

          {verseId && detail.isPending && (
            <div className="space-y-4">
              <Skeleton className="h-28" />
              <Skeleton className="h-64" />
            </div>
          )}

          {verseId && detail.isError && (
            <div className="rounded-2xl border border-border bg-card p-8">
              <ErrorRetry
                onRetry={() => void detail.refetch()}
                label={tCommon("retry")}
              />
            </div>
          )}

          {verseId && detail.data && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold font-arabic">
                        {detail.data.verse_reference}
                      </h3>
                      <p className="text-sm text-muted-foreground font-arabic">
                        {detail.data.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-1">
                        {fmt(detail.data.total_opens)} {t("admin.analytics.opensWord")}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-1">
                        {fmt(detail.data.unique_opens)} {t("admin.analytics.openersWord")}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-1">
                        {fmt(detail.data.read_rate)}% {t("admin.analytics.readRateWord")}
                      </span>
                    </div>
                  </div>

                  {detail.data.series.length > 0 ? (
                    <ChartContainer config={chartConfig} className="mt-4 h-[260px] w-full">
                      <BarChart data={chartData}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} reversed />
                        <YAxis tickLine={false} axisLine={false} orientation="right" allowDecimals={false} />
                        <ChartTooltip
                          cursor={{ fill: "transparent" }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                <p className="font-medium text-popover-foreground font-arabic">{label}</p>
                                {payload.map((entry) => (
                                  <p key={String(entry.dataKey)} className="text-muted-foreground">
                                    {entry.dataKey === "opens"
                                      ? t("admin.analytics.series.opens")
                                      : t("admin.analytics.series.reads")}
                                    : <span className="font-semibold text-ink">{entry.value}</span>
                                  </p>
                                ))}
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="opens" fill="var(--color-opens)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="reads" fill="var(--color-reads)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <p className="mt-6 text-center text-sm text-muted-foreground font-arabic">
                      {t("admin.analytics.noSeries")}
                    </p>
                  )}
                </div>

                {/* Engaged users */}
                <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold font-arabic">
                      {t("admin.analytics.users.title")}
                    </h3>
                    <Select
                      value={readFilter ?? "all"}
                      onValueChange={(value) =>
                        setReadFilter(value as VerseAnalyticsUsersParams["read"])
                      }
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[160px]">
                        <SelectValue placeholder={t("admin.analytics.users.filter")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("admin.analytics.users.filterAll")}
                        </SelectItem>
                        <SelectItem value="read">
                          {t("admin.analytics.users.filterRead")}
                        </SelectItem>
                        <SelectItem value="unread">
                          {t("admin.analytics.users.filterUnread")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {users.isPending && (
                    <div className="mt-4 space-y-2">
                      {[0, 1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-10" />
                      ))}
                    </div>
                  )}

                  {users.isError && (
                    <div className="mt-4">
                      <ErrorRetry
                        onRetry={() => void users.refetch()}
                        label={tCommon("retry")}
                      />
                    </div>
                  )}

                  {!users.isPending && !users.isError && (users.data?.items.length ?? 0) === 0 && (
                    <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
                      <Users className="h-7 w-7 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground font-arabic">
                        {t("admin.analytics.users.empty")}
                      </p>
                    </div>
                  )}

                  {!users.isPending && !users.isError && (users.data?.items.length ?? 0) > 0 && (
                    <>
                      <div className="mt-4 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("admin.analytics.users.colName")}</TableHead>
                              <TableHead className="text-end">
                                {t("admin.analytics.users.colOpens")}
                              </TableHead>
                              <TableHead className="text-end">
                                {t("admin.analytics.users.colStatus")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.data?.items.map((user) => (
                              <TableRow key={user.user_id}>
                                <TableCell>
                                  <span className="flex items-center gap-2 font-medium text-ink font-arabic">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">
                                      {user.full_name.charAt(0)}
                                    </span>
                                    <span className="truncate">{user.full_name}</span>
                                  </span>
                                </TableCell>
                                <TableCell className="text-end" dir="ltr">
                                  {fmt(user.opened_count)}
                                </TableCell>
                                <TableCell className="text-end">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-full text-xs",
                                      user.has_read
                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {user.has_read
                                      ? t("admin.analytics.users.read")
                                      : t("admin.analytics.users.unread")}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {users.data && users.data.pages > 1 && (
                        <div className="flex justify-center pt-3">
                          <AppPagination
                            page={users.data.page}
                            pages={users.data.pages}
                            onPageChange={setPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Related quiz sidebar */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
                  <h3 className="font-bold font-arabic">
                    {t("admin.analytics.quiz.title")}
                  </h3>
                  {detail.data.quiz ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-arabic">
                          {t("admin.analytics.quiz.participants")}
                        </span>
                        <span className="font-bold" dir="ltr">
                          {fmt(detail.data.quiz.participants)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-arabic">
                          {t("admin.analytics.quiz.avgScore")}
                        </span>
                        <span className="font-bold" dir="ltr">
                          {detail.data.quiz.average_score_out_of_10.toFixed(1)}/10
                        </span>
                      </div>
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={`/admin/quizzes/${detail.data.quiz.quiz_id}/builder`}>
                          <HeartHandshake className="me-1 h-4 w-4" />
                          {t("admin.analytics.quiz.open")}
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground font-arabic">
                      {t("admin.analytics.quiz.none")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}