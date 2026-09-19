import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  UserCheck,
  UserRound,
  UserRoundX,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/layout/AdminTopbar";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsers } from "../hooks/useUsers";
import type { UserRole, UserStatus } from "../types";

const ROLE_STYLES: Record<UserRole, string> = {
  ADMIN: "bg-navy text-white",
  SERVANT: "bg-brand-blue text-white",
  MEMBER: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  INACTIVE: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  BANNED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** ADMIN-only directory: counts, roles, statuses, last login. */
export function UsersAdminPage() {
  const { t } = useTranslation("users");
  const { t: tCommon } = useTranslation("common");
  const locale = "ar-EG";
  const query = useUsers();
  const users = query.data ?? [];

  const roleLabels: Record<UserRole, string> = {
    ADMIN: t("roles.ADMIN"),
    SERVANT: t("roles.SERVANT"),
    MEMBER: t("roles.MEMBER"),
  };
  const statusLabels: Record<UserStatus, string> = {
    ACTIVE: t("statuses.ACTIVE"),
    INACTIVE: t("statuses.INACTIVE"),
    SUSPENDED: t("statuses.SUSPENDED"),
    BANNED: t("statuses.BANNED"),
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      inactive: users.length - users.filter((u) => u.status === "ACTIVE").length,
      staff: users.filter((u) => u.role !== "MEMBER").length,
      neverLoggedIn: users.filter((u) => !u.last_login_at).length,
    }),
    [users],
  );

  const tiles = [
    {
      label: t("kpi.total"),
      value: stats.total,
      Icon: UserRound,
      color: "text-brand-blue",
    },
    {
      label: t("kpi.active"),
      value: stats.active,
      Icon: UserCheck,
      color: "text-emerald-600",
    },
    {
      label: t("kpi.inactive"),
      value: stats.inactive,
      Icon: UserRoundX,
      color: "text-muted-foreground",
    },
    {
      label: t("kpi.staff"),
      value: stats.staff,
      Icon: ShieldCheck,
      color: "text-navy",
    },
  ];

  return (
    <div dir="rtl" lang="ar">
      <AdminTopbar title={t("title")} subtitle={t("subtitle")} />
      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pb-16 pt-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight font-arabic">
            {t("title")}
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map(({ label, value, Icon, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 card-elevated"
            >
              <Icon className={cn("h-6 w-6 shrink-0", color)} />
              <div className="min-w-0">
                <p className="font-heading text-2xl font-bold text-ink">
                  {value}
                </p>
                <p className="truncate text-xs text-muted-foreground font-arabic">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-border bg-card card-elevated">
          {query.isPending && (
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-12 rounded-lg" />
              ))}
            </div>
          )}
          {query.isError && (
            <div className="p-5">
              <ErrorRetry
                onRetry={() => void query.refetch()}
                label={tCommon("retry")}
              />
            </div>
          )}
          {!query.isPending && !query.isError && users.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          )}
          {!query.isPending && !query.isError && users.length > 0 && (
            <>
              <div className="overflow-x-auto p-1 sm:p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.name")}</TableHead>
                      <TableHead>{t("table.email")}</TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("table.role")}
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        {t("table.status")}
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        {t("table.lastLogin")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white">
                              {(user.first_name ?? user.email).charAt(0)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-ink font-arabic">
                                {[user.first_name, user.last_name]
                                  .filter(Boolean)
                                  .join(" ") || user.email}
                              </span>
                              <span
                                className="block text-xs text-muted-foreground md:hidden"
                                dir="ltr"
                              >
                                {user.email}
                              </span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell dir="ltr" className="text-end md:text-start">
                          <span className="text-sm text-muted-foreground">
                            {user.email}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={cn("rounded-full text-xs", ROLE_STYLES[user.role])}
                          >
                            {roleLabels[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full text-xs",
                              STATUS_STYLES[user.status],
                            )}
                          >
                            {statusLabels[user.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDateTime(user.last_login_at, locale)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                {t("count", { count: users.length, never: stats.neverLoggedIn })}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}