import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Info,
  RefreshCw,
  UserRoundX,
  Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AttendanceStatusBadge } from "../components/AttendanceStatusBadge";
import { StatTile } from "../components/StatTile";
import { MeetingSelector } from "../components/MeetingSelector";
import { useMeetingAttendance } from "../hooks/useMeetingAttendance";
import { useMeetingSchedule } from "../hooks/useMeetingSchedule";
import { useMeetingStatistics } from "../hooks/useMeetingStatistics";
import { useMonthlyStatistics } from "../hooks/useMonthlyStatistics";
import { useAbsentUsers } from "../hooks/useAbsentUsers";
import { useExcuseAttendance } from "../hooks/useExcuseAttendance";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { getAuthUser } from "@/lib/auth";

function currentLocalYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function ErrorRetry({
  onRetry,
  label,
}: {
  onRetry: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
    >
      <AlertCircle className="h-4 w-4 text-status-absent" aria-hidden="true" />
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

interface TrendEntry {
  label: string;
  meeting_date: string;
  meeting_index_in_month: number;
  present_count: number;
  late_count: number;
  attendance_rate: number;
  is_held: boolean;
}

const chartConfig = {
  attended: { label: "attended", color: "var(--chart-1)" },
  late: { label: "late", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: unknown }>;
}

/** Tooltip: per-meeting rate, or the notHeld note for future meetings. */
function TrendTooltip({ active, payload }: TrendTooltipProps) {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const entry = payload?.[0]?.payload as TrendEntry | undefined;
  if (!active || !entry) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-ink">
        {new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
        }).format(new Date(entry.meeting_date))}
      </p>
      {entry.is_held ? (
        <p className="mt-0.5 text-muted-foreground">
          {`${new Intl.NumberFormat(locale).format(entry.attendance_rate)}%`}
        </p>
      ) : (
        <p className="mt-0.5 text-muted-foreground">
          {t("dashboard.meeting.notHeld")}
        </p>
      )}
    </div>
  );
}

export function AttendanceDashboardPage() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  // Dynamic keys (totals.*) are typed loosely at this one call site.
  const tk = (key: string) => t(key as never);

  const [searchParams, setSearchParams] = useSearchParams();
  const initial = currentLocalYearMonth();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const selected = searchParams.get("meeting_date") ?? undefined;

  // No ?meeting_date= in the URL resolves every query to the open meeting.
  const schedule = useMeetingSchedule(year, month);
  const meetings = schedule.data?.meetings ?? [];
  const openMeetingDate = schedule.data?.open_meeting_date ?? "";

  const stats = useMeetingStatistics(selected);
  const roster = useMeetingAttendance(selected);
  const absent = useAbsentUsers(selected);
  const monthly = useMonthlyStatistics(year, month);

  const excuse = useExcuseAttendance();
  const [excuseTarget, setExcuseTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [excuseReason, setExcuseReason] = useState("");
  const isAdmin = getAuthUser()?.role === "ADMIN";

  const selectMeeting = (meetingDate: string) => {
    const next = new URLSearchParams(searchParams);
    if (!meetingDate || meetingDate === openMeetingDate)
      next.delete("meeting_date");
    else next.set("meeting_date", meetingDate);
    setSearchParams(next, { replace: true });
  };

  const changeMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    selectMeeting("");
  };

  const summary = stats.data?.summary;

  const trendData: TrendEntry[] = useMemo(
    () =>
      (monthly.data?.meetings ?? []).map((stat) => ({
        label: t("dashboard.trend.meetingLabel", {
          index: stat.meeting_index_in_month,
        }),
        meeting_date: stat.meeting_date,
        meeting_index_in_month: stat.meeting_index_in_month,
        present_count: stat.present_count,
        late_count: stat.late_count,
        attendance_rate: stat.attendance_rate,
        is_held: stat.is_held,
      })),
    [monthly.data?.meetings, t],
  );

  const records = [...(roster.data?.attendance_records ?? [])].sort(
    (a, b) =>
      new Date(a.check_in_at).getTime() - new Date(b.check_in_at).getTime(),
  );

  const selectedIsOpen = !selected || selected === openMeetingDate;

  const monthTotals: Array<[string, string]> = monthly.data
    ? [
        ["total_attendance", String(monthly.data.total_attendance)],
        [
          "average_attendance",
          new Intl.NumberFormat(locale).format(monthly.data.average_attendance),
        ],
        [
          "attendance_rate",
          `${new Intl.NumberFormat(locale).format(monthly.data.attendance_rate)}%`,
        ],
        ["distinct_attendees", String(monthly.data.distinct_attendees)],
        ["full_attendance_count", String(monthly.data.full_attendance_count)],
        ["no_attendance_count", String(monthly.data.no_attendance_count)],
      ]
    : [];

  return (
    <>
      <AdminTopbar
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        {/* Selector row */}
        <div className="flex flex-wrap items-center gap-3">
          <MeetingSelector
            year={year}
            month={month}
            selected={selected}
            meetings={meetings}
            openMeetingDate={openMeetingDate}
            onSelect={selectMeeting}
            onMonthChange={changeMonth}
          />
          {schedule.isPending && <Skeleton className="h-9 w-[280px]" />}
        </div>

        {/* Summary cards */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.isPending &&
            [0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-[132px] rounded-xl" />
            ))}
          {stats.isError && (
            <div className="col-span-full">
              <ErrorRetry
                onRetry={() => void stats.refetch()}
                label={tCommon("retry")}
              />
            </div>
          )}
          {summary && (
            <>
              <StatTile
                size="lg"
                Icon={Users}
                iconClassName="text-mint"
                value={summary.total_present}
                label={t("dashboard.cards.present")}
              />
              <StatTile
                size="lg"
                Icon={Clock}
                iconClassName="text-status-late"
                value={summary.total_late}
                label={t("dashboard.cards.late")}
              />
              <StatTile
                size="lg"
                Icon={UserRoundX}
                iconClassName={
                  summary.is_final
                    ? "text-status-absent"
                    : "text-muted-foreground"
                }
                value={summary.total_absent}
                label={
                  summary.is_final
                    ? t("dashboard.cards.absent")
                    : t("checkIn.stats.pending")
                }
                title={
                  summary.is_final
                    ? undefined
                    : t("dashboard.absent.provisional")
                }
              />
              <StatTile
                size="lg"
                Icon={CalendarDays}
                iconClassName="text-brand-blue"
                value={summary.total_expected}
                label={t("dashboard.cards.expected")}
              />
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="font-heading text-4xl font-bold text-ink">
                  {summary.total_expected === 0
                    ? "—"
                    : `${new Intl.NumberFormat(locale).format(summary.attendance_rate)}%`}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {t("dashboard.cards.rate")}
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-mint transition-all rtl:-scale-x-100"
                    style={{
                      width:
                        summary.total_expected === 0
                          ? "0%"
                          : `${Math.min(summary.attendance_rate, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Current-meeting table */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)] lg:col-span-3">
            <h2
              className={cn(
                "font-heading text-lg font-bold text-ink",
                isArabic && "font-arabic",
              )}
            >
              {t("dashboard.table.title")}
            </h2>
            {roster.isPending && (
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-11 rounded-lg" />
                ))}
              </div>
            )}
            {roster.isError && (
              <div className="mt-4">
                <ErrorRetry
                  onRetry={() => void roster.refetch()}
                  label={tCommon("retry")}
                />
              </div>
            )}
            {roster.data && records.length === 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                {t("dashboard.table.empty")}
              </p>
            )}
            {roster.data && records.length > 0 && (
              <div className="mt-4 max-h-[420px] overflow-auto sm:overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>{t("dashboard.table.colName")}</TableHead>
                      <TableHead>{t("dashboard.table.colTime")}</TableHead>
                      <TableHead>{t("dashboard.table.colStatus")}</TableHead>
                      <TableHead>{t("dashboard.table.colMethod")}</TableHead>
                      {isAdmin && selectedIsOpen && (
                        <TableHead aria-label="actions" />
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-ink">
                          {record.user_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Intl.DateTimeFormat(locale, {
                            hour: "numeric",
                            minute: "2-digit",
                          }).format(new Date(record.check_in_at))}
                        </TableCell>
                        <TableCell>
                          <AttendanceStatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t(`method.${record.method}`)}
                        </TableCell>
                        {isAdmin && selectedIsOpen && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="focus-ring h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-status-absent"
                              onClick={() =>
                                setExcuseTarget({
                                  id: record.id,
                                  name: record.user_name,
                                })
                              }
                            >
                              {t("status.EXCUSED")}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <AlertDialog
              open={excuseTarget !== null}
              onOpenChange={(open) => !open && setExcuseTarget(null)}
            >
              <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
                <AlertDialogHeader>
                  <AlertDialogTitle className={cn(isArabic && "font-arabic")}>
                    {t("status.EXCUSED")}
                    {excuseTarget?.name ? ` — ${excuseTarget.name}` : ""}
                  </AlertDialogTitle>
                  <AlertDialogDescription
                    className={cn(isArabic && "font-arabic")}
                  >
                    {t("dashboard.absent.provisional")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={excuseReason}
                  onChange={(event) => setExcuseReason(event.target.value)}
                  placeholder={t("history.filters.member")}
                  aria-label={t("history.filters.member")}
                  className={cn(
                    "rounded-xl focus-ring",
                    isArabic && "font-arabic",
                  )}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel className={cn(isArabic && "font-arabic")}>
                    {t("checkIn.manual.cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={excuse.isPending || !excuseTarget}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!excuseTarget) return;
                      void excuse.mutateAsync({
                        attendanceId: excuseTarget.id,
                        reason: excuseReason || undefined,
                      });
                      setExcuseTarget(null);
                    }}
                    className={cn(isArabic && "font-arabic")}
                  >
                    {t("status.EXCUSED")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>

          {/* Absent users */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)] lg:col-span-2">
            <h2
              className={cn(
                "font-heading text-lg font-bold text-ink",
                isArabic && "font-arabic",
              )}
            >
              {t("dashboard.absent.title")}
            </h2>
            {!absent.isPending && absent.data && !absent.data.is_final && (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-mint/10 px-3 py-2 text-xs leading-5 text-emerald-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {t("dashboard.absent.provisional")}
              </p>
            )}
            {absent.isPending && (
              <div className="mt-4 space-y-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-12 rounded-xl" />
                ))}
              </div>
            )}
            {absent.isError && (
              <div className="mt-4">
                <ErrorRetry
                  onRetry={() => void absent.refetch()}
                  label={tCommon("retry")}
                />
              </div>
            )}
            {absent.data && absent.data.absent_users.length === 0 && (
              <p className="mt-6 rounded-xl bg-mint/10 p-4 text-center text-sm font-medium text-emerald-700">
                {t("dashboard.absent.empty")}
              </p>
            )}
            {absent.data && absent.data.absent_users.length > 0 && (
              <ul className="mt-4 divide-y divide-border">
                {absent.data.absent_users.map((user) => (
                  <li
                    key={user.user_id}
                    className="flex items-center gap-3 py-3"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
                      {user.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold text-ink",
                          isArabic && "font-arabic",
                        )}
                      >
                        {user.name}
                      </p>
                      <p
                        className="truncate text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {user.email}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full text-xs"
                    >
                      {user.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Monthly trend */}
        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[0_2px_24px_rgba(37,61,99,0.08)]">
          <h2
            className={cn(
              "font-heading text-lg font-bold text-ink",
              isArabic && "font-arabic",
            )}
          >
            {t("dashboard.trend.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.trend.subtitle")}
          </p>

          {monthly.isPending && (
            <Skeleton className="mt-4 h-[260px] rounded-xl" />
          )}
          {monthly.isError && (
            <div className="mt-4">
              <ErrorRetry
                onRetry={() => void monthly.refetch()}
                label={tCommon("retry")}
              />
            </div>
          )}
          {monthly.data && (
            <>
              <ChartContainer
                config={chartConfig}
                className="mt-4 h-[260px] w-full"
              >
                <BarChart data={trendData}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    reversed={isArabic}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    orientation={isArabic ? "right" : "left"}
                  />
                  <ChartTooltip
                    content={<TrendTooltip />}
                    cursor={{ fill: "transparent" }}
                  />
                  <Bar dataKey="attended" stackId="a" radius={6}>
                    {trendData.map((entry) => (
                      <Cell
                        key={entry.label}
                        fill={
                          entry.is_held
                            ? "var(--color-attended)"
                            : "var(--muted)"
                        }
                        stroke={entry.is_held ? undefined : "var(--border)"}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="late"
                    stackId="a"
                    fill="var(--color-late)"
                    radius={6}
                  />
                </BarChart>
              </ChartContainer>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                {monthTotals.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between gap-2 border-b border-border/60 py-1"
                  >
                    <dt className="text-muted-foreground">
                      {tk(`dashboard.totals.${key}`)}
                    </dt>
                    <dd className="font-semibold text-ink">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </section>
      </main>
    </>
  );
}
