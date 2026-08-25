import {
  Bell,
  BookOpen,
  CalendarCheck,
  Clock,
  Heart,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationType } from "../types";

export interface AccentEntry {
  Icon: LucideIcon;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

/**
 * Frozen type → icon/accent map (plan §3.5). `data.icon` may swap the
 * glyph only within the same accent and only from this allowlist; any
 * other value falls back to the type's default. No arbitrary string
 * ever reaches the DOM.
 */
export const NOTIFICATION_ACCENTS: Record<NotificationType, AccentEntry> = {
  ANNOUNCEMENT: {
    Icon: Megaphone,
    accentText: "text-mint",
    accentBg: "bg-mint/10",
    accentBorder: "border-mint",
  },
  BLOG_POST: {
    Icon: BookOpen,
    accentText: "text-brand-blue",
    accentBg: "bg-brand-blue/10",
    accentBorder: "border-brand-blue",
  },
  ATTENDANCE: {
    Icon: CalendarCheck,
    accentText: "text-brand-orange",
    accentBg: "bg-brand-orange/10",
    accentBorder: "border-brand-orange",
  },
  SYSTEM: {
    Icon: ShieldAlert,
    accentText: "text-brand-red",
    accentBg: "bg-brand-red/10",
    accentBorder: "border-brand-red",
  },
};

const ICON_ALLOWLIST: Record<string, LucideIcon> = {
  Megaphone,
  BookOpen,
  CalendarCheck,
  ShieldAlert,
  Bell,
  Users,
  MessageSquare,
  Trophy,
  Heart,
  Clock,
};

export function resolveAccent(
  type: NotificationType,
  dataIcon?: string | null,
): { Icon: LucideIcon } & AccentEntry {
  const entry = NOTIFICATION_ACCENTS[type];
  const override =
    typeof dataIcon === "string" ? ICON_ALLOWLIST[dataIcon] : undefined;
  return { ...entry, Icon: override ?? entry.Icon };
}
