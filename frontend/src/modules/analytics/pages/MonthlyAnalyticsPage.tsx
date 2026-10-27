import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Trophy, Users } from "lucide-react";

import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import { analyticsApi, currentMonth } from "../api";
import { useMonthlyAnalytics } from "../hooks/useMonthlyAnalytics";
import { useMonthlyUsers } from "../hooks/useMonthlyUsers";
import { downloadBlob } from "@/lib/download";

const PAGE_SIZE = 20;

/** The last twelve months, newest first — the only ones with data. */
function recentMonths(count = 12): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
}

/** "2026-09" → "سبتمبر ٢٠٢٦" (Arabic, with the Latin digits of the API). */
function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  const date = new Date(year, monthNumber - 1, 1);
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export default function MonthlyAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const [month, setMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const months = useMemo(() => recentMonths(), []);
  const params = useMemo(
    () => ({ q: query || undefined, page, size: PAGE_SIZE }),
    [query, page],
  );

  const overview = useMonthlyAnalytics(month);
  const users = useMonthlyUsers(month, params);

  const trendData = (overview.data?.trend ?? []).map((point) => ({
    month: formatMonth(point.period_month.slice(0, 7)),
    points: point.total_points,
    participants: point.participants,
  }));

  const completionData = (overview.data?.completion_distribution ?? []).map(
    (bucket) => ({
      name: bucket.bucket,
      value: bucket.users,
    }),
  );

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await analyticsApi.exportMonthly(month, {
        q: query || undefined,
      });
      downloadBlob(blob, `quiz-analytics-${month}.csv`);
    } catch {
      // The button is disabled while it runs; a failure only needs a hint.
      window.alert(t("export.failed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <AdminTopbar title={t("title")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={month}
          onValueChange={(value) => {
            setMonth(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label={t("month")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((value) => (
              <SelectItem key={value} value={value}>
                {formatMonth(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setPage(1);
          }}
        >
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("table.search")}
            className="w-[220px]"
            aria-label={t("table.search")}
          />
          <Button type="submit" variant="secondary">
            {t("table.search")}
          </Button>
        </form>

        <Button
          onClick={handleExport}
          disabled={exporting}
          variant="outline"
          className="ms-auto"
        >
          <Download className="size-4" />
          {exporting ? t("export.preparing") : t("export.button")}
        </Button>
      </div>

      {overview.isError ? (
        <ErrorRetry
          label={t("errors.load")}
          onRetry={() => void overview.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {overview.isPending ? (
            Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))
          ) : (
            <>
              <StatCard
                icon={Users}
                label={t("kpi.participants")}
                value={overview.data?.participants ?? 0}
              />
              <StatCard
                icon={Trophy}
                label={t("kpi.quizzesCompleted")}
                value={overview.data?.quizzes_completed ?? 0}
              />
              <StatCard
                icon={Trophy}
                label={t("kpi.totalPoints")}
                value={overview.data?.total_points ?? 0}
              />
              <StatCard
                icon={Trophy}
                label={t("kpi.averageScore")}
                value={(overview.data?.average_score_out_of_10 ?? 0).toFixed(1)}
              />
              <StatCard
                icon={Trophy}
                label={t("kpi.quizzesPublished")}
                value={overview.data?.quizzes_published ?? 0}
              />
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 font-semibold">{t("trend.title")}</h2>
          {trendData.length === 0 ? (
            <EmptyState title={t("table.empty")} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar
                  dataKey="points"
                  fill="var(--primary)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 font-semibold">{t("completion.title")}</h2>
          {completionData.length === 0 ? (
            <EmptyState title={t("table.empty")} />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={completionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {completionData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={
                          [
                            "var(--primary)",
                            "var(--chart-2, #10b981)",
                            "var(--chart-3, #f59e0b)",
                            "var(--chart-4, #ef4444)",
                          ][index % 4]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 text-sm">
                {completionData.map((entry) => (
                  <li key={entry.name} className="flex items-center gap-2">
                    <span className="font-medium">{entry.name}</span>
                    <span className="text-muted-foreground">
                      {entry.value} {t("completion.users")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-semibold">{t("table.title")}</h2>
        {users.isError ? (
          <div className="p-4">
            <ErrorRetry
              label={t("errors.load")}
              onRetry={() => void users.refetch()}
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.rank")}</TableHead>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.quizzes")}</TableHead>
                  <TableHead>{t("table.points")}</TableHead>
                  <TableHead>{t("table.average")}</TableHead>
                  <TableHead>{t("table.completion")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.isPending ? (
                  <tr>
                    <td colSpan={6} className="p-4">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ) : users.data && users.data.items.length > 0 ? (
                  users.data.items.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>{user.rank}</TableCell>
                      <TableCell className="font-medium">
                        {user.full_name}
                      </TableCell>
                      <TableCell>{user.quizzes_completed}</TableCell>
                      <TableCell>{user.total_points}</TableCell>
                      <TableCell>
                        {user.average_score_out_of_10.toFixed(1)}
                      </TableCell>
                      <TableCell>{user.completion_rate.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-muted-foreground"
                    >
                      {t("table.empty")}
                    </td>
                  </tr>
                )}
              </TableBody>
            </Table>
            {users.data && users.data.pages > 1 ? (
              <div className="border-t p-3">
                <AppPagination
                  page={users.data.page}
                  pages={users.data.pages}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
