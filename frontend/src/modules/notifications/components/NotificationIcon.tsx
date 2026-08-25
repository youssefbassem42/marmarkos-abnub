import { cn } from "@/lib/utils";
import { resolveAccent } from "./accents";
import type { NotificationData, NotificationType } from "../types";

interface NotificationIconProps {
  type: NotificationType;
  data?: NotificationData | null;
  className?: string;
}

/** 40px circular container, brand colour at 10% opacity (DR-6). */
export function NotificationIcon({
  type,
  data,
  className,
}: NotificationIconProps) {
  const { Icon, accentBg, accentText } = resolveAccent(type, data?.icon);

  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full",
        accentBg,
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={cn("size-5", accentText)} />
    </span>
  );
}
