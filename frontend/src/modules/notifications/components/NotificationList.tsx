import { useTranslation } from "react-i18next";
import { NotificationRow } from "./NotificationRow";
import type { NotificationItem } from "../types";

interface NotificationListProps {
  items: NotificationItem[];
  language: string;
  onMarkRead: (id: string) => void;
}

/** The feed body: one accessible card per notification, newest first. */
export function NotificationList({
  items,
  language,
  onMarkRead,
}: NotificationListProps) {
  const { i18n } = useTranslation();
  const activeLanguage = language ?? i18n.language;

  return (
    <ul className="space-y-3" aria-live="polite">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow
            item={item}
            language={activeLanguage}
            onMarkRead={onMarkRead}
          />
        </li>
      ))}
    </ul>
  );
}
