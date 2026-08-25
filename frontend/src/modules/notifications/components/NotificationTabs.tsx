import { Megaphone, CalendarCheck, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificationSummary } from "../hooks";
import type { NotificationTab } from "../types";

const TABS: {
  value: NotificationTab;
  labelKey:
    | "tabs.all"
    | "tabs.unread"
    | "tabs.announcements"
    | "tabs.reminders"
    | "tabs.system";
  Icon?: typeof Megaphone;
}[] = [
  { value: "all", labelKey: "tabs.all" },
  { value: "unread", labelKey: "tabs.unread" },
  { value: "announcements", labelKey: "tabs.announcements", Icon: Megaphone },
  { value: "reminders", labelKey: "tabs.reminders", Icon: CalendarCheck },
  { value: "system", labelKey: "tabs.system", Icon: ShieldAlert },
];

interface NotificationTabsProps {
  value: NotificationTab;
  onChange: (tab: NotificationTab) => void;
}

/**
 * The five feed tabs (§3.4): mint active treatment via data-state
 * styling, live counts on All/Unread from the summary query (D-4), and
 * the design's Lucide glyphs on the three type tabs.
 */
export function NotificationTabs({ value, onChange }: NotificationTabsProps) {
  const { t } = useTranslation("notifications");
  const { data } = useNotificationSummary();
  const counts = data?.tab_counts;

  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as NotificationTab)}
    >
      <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
        {TABS.map(({ value: tabValue, labelKey, Icon }) => (
          <TabsTrigger
            key={tabValue}
            value={tabValue}
            className="gap-1.5 rounded-b-none border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground data-[state=active]:border-mint data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none"
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            <span>{t(labelKey)}</span>
            {(tabValue === "all" || tabValue === "unread") && counts && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold leading-none text-ink">
                {new Intl.NumberFormat().format(counts[tabValue])}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
