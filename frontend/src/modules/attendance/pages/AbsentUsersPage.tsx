import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { AppPagination } from "@/components/common/AppPagination";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAbsentUsers } from "../hooks/useAbsentUsers";

const PAGE_SIZE = 10;

/** Full paged list of members who missed a meeting (BR-5). */
export function AbsentUsersPage() {
  const { t } = useTranslation("attendance");
  const { t: tCommon } = useTranslation("common");
  const locale = "ar-EG";
  const [searchParams, setSearchParams] = useSearchParams();

  const meetingDate = searchParams.get("meeting_date") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const patchParams = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  };

  const query = useAbsentUsers(meetingDate, { page, size: PAGE_SIZE });
  const items = query.data?.absent_users ?? [];
  const total = query.data?.absent_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const dashHref = meetingDate
    ? `/admin/dashboard?meeting_date=${encodeURIComponent(meetingDate)}`
    : "/admin/dashboard";

  const title = useMemo(() => {
    if (!meetingDate) return t("dashboard.absent.titleOpen");
    return `${t("dashboard.absent.title")} — ${new Intl.DateTimeFormat(locale).format(
      new Date(`${meetingDate}T00:00:00`),
    )}`;
  }, [meetingDate, t, locale]);

  return (
    <div dir="rtl" lang="ar">
      <AdminTopbar title={t("dashboard.absent.pageTitle")} subtitle={t("dashboard.absent.subtitle")} />
      <main className="mx-auto w-full max-w-4xl space-y-5 px-5 pb-16 pt-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={dashHref}>
              <ArrowLeft className="me-1 h-4 w-4" />
              {t("dashboard.absent.backToDashboard")}
            </Link>
          </Button>
          <p className="text-sm font-semibold text-muted-foreground font-arabic">
            {title}
            {!query.data?.is_final && (
              <Badge variant="outline" className="ms-2 rounded-full text-xs">
                {t("dashboard.absent.provisional")}
              </Badge>
            )}
          </p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 card-elevated">
          {query.isPending && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          )}
          {query.isError && (
            <ErrorRetry
              onRetry={() => void query.refetch()}
              label={tCommon("retry")}
            />
          )}
          {!query.isPending && !query.isError && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <UserRoundX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground font-arabic">
                {t("dashboard.absent.empty")}
              </p>
            </div>
          )}
          {items.length > 0 && (
            <>
              <ul className="divide-y divide-border">
                {items.map((user) => (
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
                          "font-arabic",
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
              <div className="flex justify-center border-t border-border px-5 pt-4">
                <AppPagination
                  page={page}
                  pages={pages}
                  onPageChange={(next) => patchParams({ page: next })}
                />
              </div>
              <p className="pt-3 text-center text-xs text-muted-foreground">
                {t("dashboard.absent.count", { count: total })}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}