import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell } from "lucide-react";
import { useNotificationSummary } from "@/modules/notifications/hooks";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  to: string;
  className?: string;
}

/**
 * The bell + unread badge from both designs (D-4). One component for
 * the public navbar and the admin topbar; only the destination differs.
 * The badge uses logical utilities so it flips with direction, and its
 * count is never colour-only: an sr-only label carries the meaning
 * (Design-Guide §980-993).
 */
export function NotificationBell({ to, className }: NotificationBellProps) {
  const { t } = useTranslation("landing");
  const { t: tNotifications } = useTranslation("notifications");
  const { data } = useNotificationSummary();
  const unread = data?.unread_count ?? 0;

  // Locale-aware digits: Arabic renders Arabic-Indic numerals (٣), LTR
  // layouts keep Latin digits — never hand-format counts.
  const numberFormat = new Intl.NumberFormat(
    "ar-EG",
  );
  const badge = unread > 99 ? "99+" : numberFormat.format(unread);

  return (
    <Link
      to={to}
      aria-label={t("nav.notifications")}
      className={cn(
        "focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-secondary",
        className,
      )}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && (
        <>
          <span className="absolute -top-0.5 -end-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-mint px-1 text-[11px] font-bold leading-none text-navy">
            {badge}
          </span>
          <span className="sr-only">
            {tNotifications("badges.unread", { count: unread })}
          </span>
        </>
      )}
    </Link>
  );
}
