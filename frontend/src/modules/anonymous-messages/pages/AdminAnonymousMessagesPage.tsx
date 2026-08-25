import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Check, ListFilter, MailOpen, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/context";
import { useAnonymousMessages, useRetryDelivery } from "../hooks";
import { AnonymousMessagesTable } from "../components/AnonymousMessagesTable";
import type { MessageStatusValue } from "../types";

const PAGE_SIZE = 20;

type StatusFilter = MessageStatusValue | "all";

type FilterLabel =
  | "admin.filters.all"
  | "admin.status.PENDING"
  | "admin.status.SENT"
  | "admin.status.FAILED";

const FILTERS: { value: StatusFilter; label: FilterLabel }[] = [
  { value: "all", label: "admin.filters.all" },
  { value: "PENDING", label: "admin.status.PENDING" },
  { value: "SENT", label: "admin.status.SENT" },
  { value: "FAILED", label: "admin.status.FAILED" },
];

/**
 * The admin review screen (US-021): status filter + paginated table +
 * retry. Route is ADMIN-only via the nested RequireRole in the router;
 * SERVANT never reaches this component.
 */
export function AdminAnonymousMessagesPage() {
  const { t } = useTranslation("anonymousMessages");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = (searchParams.get("status") ?? "all") as StatusFilter;
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const query = useAnonymousMessages({
    status: filter === "all" ? undefined : filter,
    page,
    size: PAGE_SIZE,
  });
  const retry = useRetryDelivery({
    status: filter === "all" ? undefined : filter,
  });

  const patchParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const items = query.data?.items ?? [];
  const pages = query.data?.pages ?? 0;

  return (
    <div>
      <AdminTopbar title={t("admin.title")} subtitle={t("admin.subtitle")} />
      <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          {/* R-2: failed messages are what an admin most needs to see —
              the filter defaults to All but FAILED is one click away. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="focus-ring inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-ink transition-colors hover:bg-secondary"
              >
                <ListFilter className="size-4" aria-hidden="true" />
                {t(
                  FILTERS.find((f) => f.value === filter)?.label ??
                    ("admin.filters.all" as const),
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              {FILTERS.map(({ value, label }) => (
                <DropdownMenuItem
                  key={value}
                  className="cursor-pointer justify-between"
                  onClick={() =>
                    patchParams({
                      status: value === "all" ? undefined : value,
                      page: undefined,
                    })
                  }
                >
                  {t(label)}
                  {filter === value && (
                    <Check className="size-4 text-mint" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <section className="card-elevated mt-4 rounded-2xl border border-border bg-card">
          {query.isPending && (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-11 rounded-lg" />
              ))}
            </div>
          )}

          {query.isError && (
            <div className="p-6">
              <div role="alert" className="mx-auto max-w-md">
                <ErrorRetry onRetry={() => void query.refetch()} />
              </div>
            </div>
          )}

          {!query.isPending && !query.isError && items.length === 0 && (
            <EmptyState
              Icon={MailOpen}
              title={t("admin.empty.title")}
              action={
                <p className="max-w-md text-xs text-muted-foreground">
                  {t("admin.empty.body")}
                </p>
              }
            />
          )}

          {items.length > 0 && (
            <>
              <AnonymousMessagesTable
                items={items}
                language={language}
                retryPending={retry.isPending}
                onRetry={(id) =>
                  retry.mutate(id, {
                    onSuccess: () => toast.success(t("admin.retry.success")),
                    onError: (error) => toast.error(getApiErrorMessage(error)),
                  })
                }
              />
              {pages > 1 && (
                <AppPagination
                  className="border-t border-border py-3"
                  page={page}
                  pages={pages}
                  onPageChange={(next) => patchParams({ page: String(next) })}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
