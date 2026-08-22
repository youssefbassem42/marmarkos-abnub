import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { History, LayoutDashboard, ScanLine } from "lucide-react";
import logo from "@/assets/church-logo.png";
import { useLanguage } from "@/i18n/context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/attendance/check-in", labelKey: "checkIn", Icon: ScanLine },
  { to: "/attendance/dashboard", labelKey: "dashboard", Icon: LayoutDashboard },
  { to: "/attendance/history", labelKey: "history", Icon: History },
] as const;

/** Admin navigation sidebar; physical side follows the active language. */
export function AdminSidebar() {
  const { t } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";

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
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.section")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ to, labelKey, Icon }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={t(`nav.${labelKey}`)}
                      >
                        <Icon aria-hidden="true" />
                        <span className={isArabic ? "font-arabic" : undefined}>
                          {t(`nav.${labelKey}`)}
                        </span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
