import { useTranslation } from "react-i18next";
import { useNotificationSummary } from "@/modules/notifications/hooks";
import { useLanguage } from "@/i18n/context";

/**
 * Badge for the mobile menu's notifications row: same count rules as
 * the desktop bell (hidden at 0, 99+ cap), positioned with logical
 * utilities so it flips with direction.
 */
export function MobileBellBadge() {
  const { t } = useTranslation("notifications");
  const { language } = useLanguage();
  const { data } = useNotificationSummary();
  const unread = data?.unread_count ?? 0;
  if (unread <= 0) return null;

  const numberFormat = new Intl.NumberFormat(
    language === "ar" ? "ar-EG" : "en-GB",
  );
  const badge = unread > 99 ? "99+" : numberFormat.format(unread);

  return (
    <span className="absolute -top-1.5 -end-2 grid h-4 min-w-4 place-items-center rounded-full bg-mint px-1 text-[10px] font-bold leading-none text-navy">
      {badge}
      <span className="sr-only">{t("badges.unread", { count: unread })}</span>
    </span>
  );
}
