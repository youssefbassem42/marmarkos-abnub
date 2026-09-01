import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  History,
  LayoutDashboard,
  MessageSquare,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";
import logo from "@/assets/church-logo.png";

import { getUserRole } from "@/lib/auth";
import {
  BrandMessageHeading,
  BrandSupportingLine,
} from "@/pages/auth/components/BrandPanel";
import { AdminUserMenu } from "./AdminUserMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavKey =
  | "dashboard"
  | "members"
  | "attendance"
  | "checkIn"
  | "history"
  | "events"
  | "bibleVerses"
  | "verses"
  | "weeklyVerses"
  | "quizzes"
  | "messages"
  | "notifications"
  | "reports"
  | "verseAnalytics"
  | "quizAnalytics"
  | "monthlyAnalytics"
  | "settings";

interface SubItem {
  to: string;
  labelKey: Extract<NavKey, "checkIn" | "history" | "verses" | "weeklyVerses" | "verseAnalytics" | "quizAnalytics" | "monthlyAnalytics">;
}

interface DisabledItem {
  labelKey: NavKey;
  Icon: typeof Users;
  kind: "disabled";
}

interface LinkItem {
  to: string;
  labelKey: NavKey;
  Icon: typeof Users;
  /** Rendered when the current path lives under this section. */
  subItems?: readonly SubItem[];
  subPathPrefix?: string;
  /** ADMIN-only sections are hidden entirely for SERVANT (D-8). */
  adminOnly?: boolean;
  kind?: "link";
}

const NAV_ITEMS: readonly (LinkItem | DisabledItem)[] = [
  // Design order (D-8): dashboard, members*, attendance, events*,
  // bibleVerses, quizzes, messages, notifications, reports/analytics,
  // settings* — * = disabled.
  { to: "/admin/dashboard", labelKey: "dashboard", Icon: LayoutDashboard },
  { labelKey: "members", Icon: Users, kind: "disabled" },
  {
    to: "/admin/attendance/check-in",
    labelKey: "attendance",
    Icon: ScanLine,
    subItems: [
      { to: "/admin/attendance/check-in", labelKey: "checkIn" },
      { to: "/admin/attendance/history", labelKey: "history" },
    ],
    subPathPrefix: "/admin/attendance",
  },
  { labelKey: "events", Icon: Calendar, kind: "disabled" },
  {
    to: "/admin/bible-verses",
    labelKey: "bibleVerses",
    Icon: BookOpen,
    subItems: [
      { to: "/admin/bible-verses", labelKey: "verses" },
      {
        to: "/admin/bible-verses?status=scheduled",
        labelKey: "weeklyVerses",
      },
    ],
    subPathPrefix: "/admin/bible-verses",
  },
  { to: "/admin/quizzes", labelKey: "quizzes", Icon: ClipboardList },
  {
    to: "/admin/anonymous-messages",
    labelKey: "messages",
    Icon: MessageSquare,
    adminOnly: true,
  },
  { to: "/admin/notifications", labelKey: "notifications", Icon: Bell },
  {
    to: "/admin/analytics/verses",
    labelKey: "reports",
    Icon: BarChart3,
    subItems: [
      { to: "/admin/analytics/verses", labelKey: "verseAnalytics" },
      { to: "/admin/analytics/quizzes", labelKey: "quizAnalytics" },
      { to: "/admin/analytics/monthly", labelKey: "monthlyAnalytics" },
    ],
    subPathPrefix: "/admin/analytics",
  },
  { labelKey: "settings", Icon: Settings, kind: "disabled" },
] as const;

/** Admin navigation sidebar; physical side follows the active language. */
export function AdminSidebar() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const role = getUserRole();
  const { pathname } = useLocation();

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader>
        <div
          className="flex items-center gap-2 px-2 py-3 font-arabic"
        >
          <img src={logo} alt="" aria-hidden="true" className="h-10 w-auto" />
          <span className="text-sm font-bold text-ink group-data-[collapsible=icon]:hidden">
            {t("nav.section")}
          </span>
        </div>
        {/* DR-10 brand block: hidden entirely in the icon-rail state. */}
        <div className="px-4 pb-2 group-data-[collapsible=icon]:hidden">
          <BrandMessageHeading
            lang="ar"
            className="!mt-1 !text-xl !leading-snug lg:!text-xl font-arabic"
          />
          <BrandSupportingLine
            lang="ar"
            className="!mt-2 !max-w-none !text-xs !leading-relaxed text-muted-foreground"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.section")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                if (item.kind === "disabled") {
                  // D-8: unbuilt sections stay visible but inert, with
                  // the same comingSoon treatment Phase 2 gave the bell.
                  return (
                    <SidebarMenuItem key={item.labelKey}>
                      <SidebarMenuButton
                        disabled
                        aria-disabled
                        className="cursor-not-allowed opacity-50"
                        tooltip={`${t(`nav.${item.labelKey}`)} · ${tCommon("comingSoon")}`}
                      >
                        <item.Icon aria-hidden="true" />
                        <span className="font-arabic">
                          {t(`nav.${item.labelKey}`)}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                if (item.adminOnly && role !== "ADMIN") return null;
                const showSubItems =
                  item.subItems !== undefined &&
                  item.subPathPrefix !== undefined &&
                  pathname.startsWith(item.subPathPrefix);
                return (
                  <SidebarMenuItem key={item.to}>
                    <NavLink to={item.to}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={t(`nav.${item.labelKey}`)}
                        >
                          <item.Icon aria-hidden="true" />
                          <span className="font-arabic">
                            {t(`nav.${item.labelKey}`)}
                          </span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                    {showSubItems && (
                      <SidebarMenuSub>
                        {item.subItems?.map((sub) => (
                          <SidebarMenuSubItem key={sub.to}>
                            <NavLink to={sub.to}>
                              {({ isActive }) => (
                                <SidebarMenuSubButton isActive={isActive}>
                                  <span className="font-arabic">
                                    {t(`nav.${sub.labelKey}`)}
                                  </span>
                                </SidebarMenuSubButton>
                              )}
                            </NavLink>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <AdminUserMenu />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
