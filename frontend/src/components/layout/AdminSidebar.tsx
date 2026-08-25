import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  Calendar,
  History,
  LayoutDashboard,
  MessageSquare,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";
import logo from "@/assets/church-logo.png";
import { useLanguage } from "@/i18n/context";
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
  | "messages"
  | "notifications"
  | "reports"
  | "settings";

interface SubItem {
  to: string;
  labelKey: Extract<NavKey, "checkIn" | "history">;
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
  // messages, notifications, reports*, settings* — * = disabled.
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
    to: "/admin/anonymous-messages",
    labelKey: "messages",
    Icon: MessageSquare,
    adminOnly: true,
  },
  { to: "/admin/notifications", labelKey: "notifications", Icon: Bell },
  { labelKey: "reports", Icon: BarChart3, kind: "disabled" },
  { labelKey: "settings", Icon: Settings, kind: "disabled" },
] as const;

/** Admin navigation sidebar; physical side follows the active language. */
export function AdminSidebar() {
  const { t } = useTranslation("admin");
  const { t: tCommon } = useTranslation("common");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const role = getUserRole();
  const { pathname } = useLocation();

  return (
    <Sidebar side={isArabic ? "right" : "left"} collapsible="icon">
      <SidebarHeader>
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-3",
            isArabic && "font-arabic",
          )}
        >
          <img src={logo} alt="" aria-hidden="true" className="h-10 w-auto" />
          <span className="text-sm font-bold text-ink group-data-[collapsible=icon]:hidden">
            {t("nav.section")}
          </span>
        </div>
        {/* DR-10 brand block: hidden entirely in the icon-rail state. */}
        <div className="px-4 pb-2 group-data-[collapsible=icon]:hidden">
          <BrandMessageHeading
            lang={language}
            className={cn(
              "!mt-1 !text-xl !leading-snug lg:!text-xl",
              isArabic && "font-arabic",
            )}
          />
          <BrandSupportingLine
            lang={language}
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
                        <span className={isArabic ? "font-arabic" : undefined}>
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
                          <span
                            className={isArabic ? "font-arabic" : undefined}
                          >
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
                                  <span
                                    className={
                                      isArabic ? "font-arabic" : undefined
                                    }
                                  >
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
