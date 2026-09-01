import { NotificationRow } from "./NotificationRow";
import type { NotificationItem } from "../types";

interface NotificationListProps {
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
}

/** The feed body: one accessible card per notification, newest first. */
export function NotificationList({
  items,
  onMarkRead,
}: NotificationListProps) {
  return (
    <ul className="space-y-3" aria-live="polite">
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow
            item={item}
            onMarkRead={onMarkRead}
          />
        </li>
      ))}
    </ul>
  );
}
