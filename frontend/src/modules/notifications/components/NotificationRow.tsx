import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { NotificationIcon } from "./NotificationIcon";
import { NOTIFICATION_ACCENTS } from "./accents";
import { isNewNotification, relativeTime } from "./relativeTime";
import type { NotificationItem } from "../types";

interface NotificationRowProps {
  item: NotificationItem;
  /** Marks the row read (idempotent server-side, BR-3). */
  onMarkRead: (id: string) => void;
}

/**
 * One feed card (plan §3.5): elevated card with an accent start border,
 * 40px icon, title + optional mint "New" pill (D-26), body copy and a
 * trailing time block with an unread dot. Clicking marks the row read;
 * a stored CTA is followed on the same click.
 */
export function NotificationRow({
  item,
  onMarkRead,
}: NotificationRowProps) {
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const accent = NOTIFICATION_ACCENTS[item.type];
  const title = item.title_ar;
  const message = item.message_ar;
  const isNew = isNewNotification(item);
  const ctaUrl =
    typeof item.data?.cta_url === "string" ? item.data.cta_url : null;

  const handleClick = () => {
    if (!item.is_read) onMarkRead(item.id);
    if (ctaUrl) navigate(ctaUrl);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "card-elevated focus-ring flex w-full items-start gap-4 rounded-2xl rounded-s-none border border-border border-s-4 bg-card p-4 text-start transition-colors hover:bg-secondary/60",
        accent.accentBorder,
        !item.is_read && "bg-mint/[0.04]",
      )}
    >
      <NotificationIcon type={item.type} data={item.data} />
      <span className="min-w-0 grow">
        <span
          className={cn(
            "flex items-center gap-2 font-semibold text-ink font-arabic",
          )}
        >
          <span className="truncate">{title}</span>
          {isNew && (
            <span className="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold leading-none text-navy">
              {t("badges.new")}
            </span>
          )}
        </span>
        <span
          className={cn(
            "mt-1 line-clamp-2 block text-sm text-muted-foreground font-arabic",
          )}
        >
          {message}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <time
          dateTime={item.created_at}
          className={cn(
            "text-xs text-muted-foreground font-arabic",
          )}
        >
          {relativeTime(item.created_at, t)}
        </time>
        {!item.is_read && (
          <>
            <span
              className={cn("size-2 rounded-full", accent.accentBg)}
              aria-hidden="true"
            />
            <span className="sr-only">{t("badges.unread", { count: 1 })}</span>
          </>
        )}
      </span>
    </button>
  );
}
