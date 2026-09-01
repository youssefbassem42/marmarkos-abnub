import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuizTable } from "../../components/QuizTable";
import { useAdminQuizzes } from "../../hooks";
import type { QuizStatus } from "../../types";

const STATUS_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "all", labelKey: "admin.list.allStatuses" },
  { value: "DRAFT", labelKey: "admin.list.statuses.DRAFT" },
  { value: "PUBLISHED", labelKey: "admin.list.statuses.PUBLISHED" },
  { value: "ARCHIVED", labelKey: "admin.list.statuses.ARCHIVED" },
];

export default function QuizListPage() {
  const { t } = useTranslation("quiz");

  const [searchParams, setSearchParams] = useSearchParams();

  const statusFilter = searchParams.get("status") ?? "";
  const searchQuery = searchParams.get("q") ?? "";
  const verseFilter = searchParams.get("verse") ?? "";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const size = Number(searchParams.get("size") ?? "20") || 20;

  const patchParams = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  const apiParams = useMemo(() => {
    const params: Record<string, unknown> = { page, size };
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    if (searchQuery) params.search = searchQuery;
    if (verseFilter) params.verse = verseFilter;
    return params;
  }, [page, size, statusFilter, searchQuery, verseFilter]);

  const query = useAdminQuizzes(apiParams);
  const items = query.data?.items ?? [];
  const pages = query.data?.pages ?? 0;

  const statusLabels: Record<string, string> = {
    all: t("admin.list.allStatuses"),
    DRAFT: "Draft",
    PUBLISHED: "Published",
    ARCHIVED: "Archived",
  };

  return (
    <>
      <AdminTopbar
        title={t("admin.list.title")}
        subtitle={t("admin.manage.subtitle")}
      />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <div
          dir="rtl"
          lang="ar"
          className="space-y-5"
        >
          {/* Filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-auto sm:min-w-[220px]">
                <Search
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground end-3"
                  aria-hidden="true"
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => patchParams({ q: e.target.value || undefined })}
                  placeholder={t("admin.list.search")}
                  className="h-9 pe-9 ps-3"
                />
              </div>

              <Select
                value={statusFilter || "all"}
                onValueChange={(val) =>
                  patchParams({ status: val === "all" ? undefined : val })
                }
              >
                <SelectTrigger className="h-9 w-full sm:w-[160px]">
                  <SelectValue placeholder={t("admin.list.statusFilter")} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {statusLabels[opt.value] ?? opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={verseFilter}
                onChange={(e) =>
                  patchParams({ verse: e.target.value || undefined })
                }
                placeholder={t("admin.list.verseFilter")}
                className="h-9 w-full sm:w-[180px]"
              />
            </div>

            <Button asChild size="sm" className="shrink-0">
              <Link to="/admin/quizzes/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t("admin.list.create")}
              </Link>
            </Button>
          </div>

          {/* Table */}
          <section className="rounded-2xl border border-border bg-card card-elevated">
            {query.isPending && (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-primary/10" />
                ))}
              </div>
            )}

            {!query.isPending && (
              <>
                <QuizTable items={items} isPending={false} />

                {items.length > 0 && (
                  <div className="flex justify-center border-t border-border px-5 py-3">
                    <AppPagination
                      page={page}
                      pages={pages}
                      onPageChange={(next) => patchParams({ page: next })}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
