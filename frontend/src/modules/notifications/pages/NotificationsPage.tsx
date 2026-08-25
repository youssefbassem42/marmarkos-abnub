import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { BellOff } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AppPagination } from "@/components/common/AppPagination";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/context";
import { useMarkRead, useNotifications } from "../hooks";
import { NotificationList } from "../components/NotificationList";
import { NotificationTabs } from "../components/NotificationTabs";
import { NotificationFilterMenu } from "../components/NotificationFilterMenu";
import { rangeToSince, type TimeRange } from "../components/timeRange";
import { MarkAllReadButton } from "../components/MarkAllReadButton";
import { NotificationInfoCards } from "../components/NotificationInfoCards";

const PAGE_SIZE = 20;

function parseTab(value: string | null): string {
  return value ?? "all";
}

/**
 * Member-facing feed (US-013): public shell, tabs + filter + pager all
 * mirrored into the URL so reloads and shared links survive.
 */
export function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [searchParams, setSearchParams] = useSearchParams();
  const markRead = useMarkRead();

  const tab = parseTab(searchParams.get("tab"));
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const range = (searchParams.get("range") ?? "allTime") as TimeRange;
  const since = rangeToSince(range);

  const feed = useNotifications({
    tab: tab as never,
    page,
    size: PAGE_SIZE,
    since,
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

  const items = feed.data?.items ?? [];
  const pages = feed.data?.pages ?? 0;

  return (
    <div
      className="min-h-screen bg-background"
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
    >
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-5 pb-16 pt-28 lg:px-8">
        <header className="text-center">
          <h1
            className={cn(
              "font-heading text-3xl font-extrabold tracking-tight text-ink",
              isArabic && "font-arabic",
            )}
          >
            {t("title")}
          </h1>
          <p
            className={cn(
              "mt-2 text-sm text-muted-foreground",
              isArabic && "font-arabic text-base",
            )}
          >
            {t("subtitle")}
          </p>
        </header>

        <div className="mt-8">
          <NotificationTabs
            value={tab as never}
            onChange={(next) =>
              patchParams({
                tab: next === "all" ? undefined : next,
                page: undefined,
              })
            }
          />

          <div className="mt-4 flex items-center justify-between gap-3">
            <MarkAllReadButton />
            <NotificationFilterMenu
              value={range}
              onChange={(next) =>
                patchParams({
                  range: next === "allTime" ? undefined : next,
                  page: undefined,
                })
              }
            />
          </div>

          <div className="mt-6">
            {feed.isPending && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-24 rounded-2xl" />
                ))}
              </div>
            )}

            {feed.isError && (
              <div
                role="alert"
                className="card-elevated rounded-2xl border border-border bg-card p-8 text-center"
              >
                <p
                  className={cn(
                    "font-semibold text-ink",
                    isArabic && "font-arabic",
                  )}
                >
                  {t("error.title")}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm text-muted-foreground",
                    isArabic && "font-arabic",
                  )}
                >
                  {t("error.body")}
                </p>
                <div className="mx-auto mt-4 max-w-xs">
                  <ErrorRetry onRetry={() => void feed.refetch()} />
                </div>
              </div>
            )}

            {!feed.isPending && !feed.isError && items.length === 0 && (
              <EmptyState
                Icon={BellOff}
                title={t("empty.title")}
                action={
                  <p
                    className={cn(
                      "max-w-md text-xs text-muted-foreground",
                      isArabic && "font-arabic",
                    )}
                  >
                    {t("empty.body")}
                  </p>
                }
              />
            )}

            {items.length > 0 && (
              <>
                <NotificationList
                  items={items}
                  language={language}
                  onMarkRead={(id) => markRead.mutate(id)}
                />
                {pages > 1 && (
                  <AppPagination
                    className="mt-6"
                    page={page}
                    pages={pages}
                    onPageChange={(next) => patchParams({ page: String(next) })}
                  />
                )}
              </>
            )}
          </div>

          <NotificationInfoCards className="mt-12" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
