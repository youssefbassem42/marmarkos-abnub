import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminVerses } from "../../hooks";
import { VerseKpiRow } from "../../components/admin/VerseKpiRow";
import { VerseStatusTabs } from "../../components/admin/VerseStatusTabs";
import { VerseFilterBar } from "../../components/admin/VerseFilterBar";
import { VerseFilterSheet } from "../../components/admin/VerseFilterSheet";
import { VerseTable } from "../../components/admin/VerseTable";
import { VerseMobileList } from "../../components/admin/VerseMobileList";
import type { VerseStatus } from "../../types";

const PAGE_SIZES = [10, 20, 50];

function VerseTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {[0, 1, 2, 3, 4]
        .slice(0, rows)
        .map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
    </div>
  );
}

function VerseCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border p-4">
      {[0, 1, 2, 3]
        .slice(0, rows)
        .map((i) => (
          <div key={i} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        ))}
    </div>
  );
}

export default function BibleManagementPage() {
  const { t } = useTranslation("bible");
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = (searchParams.get("status") || undefined) as
    | VerseStatus
    | undefined;
  const q = searchParams.get("q") || undefined;
  const page = Number(searchParams.get("page")) || 1;
  const size = Number(searchParams.get("size")) || 20;
  const dateFrom = searchParams.get("date_from") || undefined;
  const dateTo = searchParams.get("date_to") || undefined;

  const patchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([k, v]) => {
          if (v === undefined || v === "") next.delete(k);
          else next.set(k, v);
        });
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const query = useAdminVerses({
    status,
    q,
    date_from: dateFrom,
    date_to: dateTo,
    page,
    size,
  });

  const items = query.data?.items ?? [];
  const pages = query.data?.pages ?? 0;
  const total = query.data?.total ?? 0;

  return (
    <div>
      <AdminTopbar title={t("admin.title")} subtitle={t("admin.subtitle")} />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-6 lg:px-8">
        {/* KPI row */}
        <VerseKpiRow />

        {/* Status tabs */}
        <VerseStatusTabs
          value={status}
          onChange={(s) => patchParams({ status: s, page: undefined })}
        />

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isMobile ? (
            <div className="flex items-center gap-3">
              <VerseFilterSheet
                q={q}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onPatch={patchParams}
              />
              <p className="text-sm text-muted-foreground">
                {total} {t("admin.kpi.total")}
              </p>
            </div>
          ) : (
            <VerseFilterBar
              q={q}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onPatch={patchParams}
            />
          )}

          <Button asChild size="sm" className="shrink-0">
            <Link to="/admin/bible-verses/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("admin.create")}
            </Link>
          </Button>
        </div>

        {/* Content card */}
        <section className="rounded-2xl border border-border bg-card">
          {/* Loading */}
          {query.isPending &&
            (isMobile ? <VerseCardSkeleton /> : <VerseTableSkeleton />)}

          {/* Error */}
          {query.isError && (
            <div className="p-6">
              <div role="alert" className="mx-auto max-w-md">
                <ErrorRetry onRetry={() => void query.refetch()} />
              </div>
            </div>
          )}

          {/* Empty */}
          {!query.isPending && !query.isError && items.length === 0 && (
            <EmptyState
              Icon={BookOpen}
              title={t("admin.table.empty")}
              action={
                <Button asChild size="sm" className="mt-2">
                  <Link to="/admin/bible-verses/new">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t("admin.create")}
                  </Link>
                </Button>
              }
            />
          )}

          {/* Data */}
          {items.length > 0 && (
            <>
              {isMobile ? (
                <VerseMobileList items={items} />
              ) : (
                <VerseTable items={items} />
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {total} {t("admin.kpi.total")}
                </p>
                <div className="flex items-center gap-3">
                  <Select
                    value={String(size)}
                    onValueChange={(v) =>
                      patchParams({ size: v, page: undefined })
                    }
                  >
                    <SelectTrigger className="h-8 w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AppPagination
                    page={page}
                    pages={pages}
                    onPageChange={(p) => patchParams({ page: String(p) })}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* FAB on mobile */}
        {isMobile && (
          <Button
            asChild
            className="fixed bottom-6 end-6 h-14 w-14 rounded-full shadow-lg"
            size="icon"
          >
            <Link to="/admin/bible-verses/new">
              <Plus className="h-6 w-6" aria-hidden="true" />
              <span className="sr-only">{t("admin.create")}</span>
            </Link>
          </Button>
        )}
      </main>
    </div>
  );
}
