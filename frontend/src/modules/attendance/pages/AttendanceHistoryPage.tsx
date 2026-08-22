import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  QrCode,
  SearchX,
} from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AttendanceStatusBadge } from "../components/AttendanceStatusBadge";
import {
  HistoryFilters,
  type HistoryFilterValues,
} from "../components/HistoryFilters";
import { useAttendanceHistory } from "../hooks/useAttendanceHistory";
import { buildAttendanceCsv, downloadCsv } from "../lib/csv";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey = "meeting_date" | "check_in_at";

export function AttendanceHistoryPage() {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const locale = language === "ar" ? "ar-EG" : "en-GB";

  const [searchParams, setSearchParams] = useSearchParams();

  // All filter/paging state lives in the URL query string.
  const values: HistoryFilterValues = useMemo(
    () => ({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      user_id: searchParams.get("user") ?? undefined,
      status:
        (searchParams.get("status") as HistoryFilterValues["status"]) ?? "",
    }),
    [searchParams],
  );
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const size = Number(searchParams.get("size") ?? "20") || 20;
  const sort = (searchParams.get("sort") as SortKey) ?? "meeting_date";
  const order = (searchParams.get("order") as "asc" | "desc") ?? "desc";

  const patchParams = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const hasAnyFilter = Boolean(
    values.from || values.to || values.user_id || values.status,
  );

  const query = useAttendanceHistory({
    start_date: values.from,
    end_date: values.to,
    user_id: values.user_id,
    status: values.status || undefined,
    page,
    size,
    sort,
    order,
  });

  const records = query.data?.attendance_records ?? [];
  const total = query.data?.total_count ?? 0;
  const pages = query.data?.pages ?? 0;
  const fromRow = total === 0 ? 0 : (page - 1) * size + 1;
  const toRow = Math.min(page * size, total);

  const toggleSort = (key: SortKey) => {
    patchParams({
      sort: key,
      order: key === sort && order === "desc" ? "asc" : "desc",
    });
  };

  const exportCsv = async () => {
    const now = new Date();
    const filename = t("history.export.filename", {
      year: now.getFullYear(),
      month: String(now.getMonth() + 1).padStart(2, "0"),
    });
    try {
      const blob = await buildAttendanceCsv({
        headers: [
          t("history.table.colDate"),
          t("history.table.colName"),
          t("history.table.colTime"),
          t("history.table.colStatus"),
          t("history.table.colRecordedBy"),
        ],
        formatRow: (record) => [
          record.meeting_date,
          record.user_name,
          new Intl.DateTimeFormat(locale, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(record.check_in_at)),
          t(`status.${record.status}` as never),
          record.recorded_by_name,
        ],
        filters: hasAnyFilter
          ? {
              start_date: values.from,
              end_date: values.to,
              user_id: values.user_id,
              status: values.status || undefined,
            }
          : undefined,
      });
      downloadCsv(blob, `${filename}.csv`);
      toast.success(t("history.export.csv"));
    } catch {
      toast.error(t("errors.network"));
    }
  };

  return (
    <>
      <AdminTopbar
        title={t("history.title")}
        subtitle={t("history.subtitle")}
      />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <div
          dir={isArabic ? "rtl" : "ltr"}
          lang={language}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <HistoryFilters
              values={values}
              onChange={(next) =>
                patchParams({
                  from: next.from,
                  to: next.to,
                  user: next.user_id,
                  status: next.status,
                })
              }
            />
            <button
              type="button"
              onClick={() => void exportCsv()}
              className="btn-outline h-11 px-4 text-sm"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className={isArabic ? "font-arabic" : undefined}>
                {t("history.export.csv")}
              </span>
            </button>
          </div>

          <section className="rounded-2xl border border-border bg-card shadow-[0_2px_24px_rgba(37,61,99,0.08)]">
            {query.isPending && (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-11 rounded-lg" />
                ))}
              </div>
            )}

            {!query.isPending && records.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                {hasAnyFilter ? (
                  <SearchX
                    className="h-10 w-10 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-mint/15">
                    <QrCode className="h-8 w-8 text-mint" aria-hidden="true" />
                  </span>
                )}
                {/* TASK-504: distinguish "no records for filters" from "none at all". */}
                <p
                  className={cn(
                    "text-sm text-muted-foreground",
                    isArabic && "font-arabic text-base",
                  )}
                >
                  {t("history.table.empty")}
                </p>
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={() => setSearchParams({}, { replace: true })}
                    className="btn-outline mt-1 px-5 py-2 text-sm"
                  >
                    <span className={isArabic ? "font-arabic" : undefined}>
                      {t("history.filters.reset")}
                    </span>
                  </button>
                )}
              </div>
            )}

            {records.length > 0 && (
              <>
                <div className="overflow-x-auto p-1 sm:p-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <button
                            type="button"
                            onClick={() => toggleSort("meeting_date")}
                            className="focus-ring inline-flex items-center gap-1 rounded-sm font-medium"
                            aria-label={t("history.table.colDate")}
                          >
                            {t("history.table.colDate")}
                            {sort === "meeting_date" && (
                              <SortArrow descending={order === "desc"} />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>{t("history.table.colName")}</TableHead>
                        <TableHead>
                          <button
                            type="button"
                            onClick={() => toggleSort("check_in_at")}
                            className="focus-ring inline-flex items-center gap-1 rounded-sm font-medium"
                            aria-label={t("history.table.colTime")}
                          >
                            {t("history.table.colTime")}
                            {sort === "check_in_at" && (
                              <SortArrow descending={order === "desc"} />
                            )}
                          </button>
                        </TableHead>
                        <TableHead>{t("history.table.colStatus")}</TableHead>
                        <TableHead>
                          {t("history.table.colRecordedBy")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {query.isFetching && (
                        <TableRow aria-hidden="true">
                          <TableCell
                            colSpan={5}
                            className="h-0.5 bg-mint/30 p-0"
                          />
                        </TableRow>
                      )}
                      {records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Intl.DateTimeFormat(locale, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            }).format(new Date(record.meeting_date))}
                          </TableCell>
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
                            {record.recorded_by_name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      isArabic && "font-arabic",
                    )}
                  >
                    {t("history.pagination.showing", {
                      from: fromRow,
                      to: toRow,
                      total,
                    })}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => patchParams({ page: page - 1 })}
                      className="focus-ring inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft
                        className="h-4 w-4 rtl:hidden"
                        aria-hidden="true"
                      />
                      <ChevronRight
                        className="hidden h-4 w-4 rtl:block"
                        aria-hidden="true"
                      />
                      <span className={isArabic ? "font-arabic" : undefined}>
                        {t("history.pagination.previous")}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!query.data?.has_next}
                      onClick={() => patchParams({ page: page + 1 })}
                      className="focus-ring inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className={isArabic ? "font-arabic" : undefined}>
                        {t("history.pagination.next")}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 rtl:hidden"
                        aria-hidden="true"
                      />
                      <ChevronLeft
                        className="hidden h-4 w-4 rtl:block"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function SortArrow({ descending }: { descending: boolean }) {
  return (
    <span aria-hidden="true" className="text-[10px]">
      {descending ? "▼" : "▲"}
    </span>
  );
}
