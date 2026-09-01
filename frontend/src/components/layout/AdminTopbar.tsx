import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { NotificationBell } from "@/modules/notifications/components/NotificationBell";

import { ThemeToggle } from "./ThemeToggle";
import { AdminUserMenu } from "./AdminUserMenu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AdminTopbarProps {
  title?: string;
  subtitle?: string;
  /**
   * When set, the leading control is a back link instead of the sidebar
   * trigger — layouts without a SidebarProvider (e.g. the check-in split
   * screen) must not render SidebarTrigger, whose hook throws outside one.
   */
  backHref?: string;
}

/**
 * The admin header row from the check-in design: hamburger → page title
 * + subtitle → spacer → notification bell (disabled, no badge — the
 * notifications module is Phase 4) → avatar menu → language → theme.
 */
export function AdminTopbar({ title, subtitle, backHref }: AdminTopbarProps) {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const { t: tAttendance } = useTranslation("attendance");

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background">
      <div
        dir="rtl"
        lang="ar"
        className="flex items-center gap-3 px-5 py-3 lg:px-8"
      >
        {backHref ? (
          <Link
            to={backHref}
            aria-label={t("back")}
            title={t("back")}
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-secondary"
          >
            <ChevronLeft
              className="h-5 w-5 rtl:rotate-180"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <SidebarTrigger aria-label="Toggle sidebar" />
        )}

        <div className="min-w-0">
          {title ? (
            <h1
              className="truncate font-heading text-2xl font-bold text-ink font-arabic"
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className="truncate text-sm text-muted-foreground font-arabic"
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-2">
          <NotificationBell to="/admin/notifications" />

          <ThemeToggle className="hidden sm:inline-flex" />

          <AdminUserMenu />
        </div>
      </div>
    </header>
  );
}
