import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  ScanLine,
  User as UserIcon,
} from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { logoutUser } from "@/lib/api";
import { notificationKeys } from "@/modules/notifications/api/queryKeys";
import {
  clearAuth,
  getAuthUser,
  getUserRole,
  isAttendanceManager,
} from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Avatar + role card opening the account dropdown. Shared by the
 * AdminTopbar row and the AdminSidebar footer (DR-10) so sign-out and
 * navigation stay identical everywhere.
 */
export function AdminUserMenu() {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const { t: tAttendance } = useTranslation("attendance");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = getAuthUser();

  const handleSignOut = async () => {
    await logoutUser();
    clearAuth();
    // DEF-16 (scoped): a second user on this browser must never see the
    // first user's unread count.
    queryClient.removeQueries({ queryKey: notificationKeys.all });
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-ring flex w-full items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-secondary"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-navy text-sm font-bold text-white">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (user?.first_name ?? "?")[0].toUpperCase()
            )}
          </span>
          <span className="hidden min-w-0 text-start md:block">
            <span
              className={cn(
                "block truncate text-sm font-semibold leading-tight text-ink",
                isArabic && "font-arabic",
              )}
            >
              {user?.first_name} {user?.last_name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user?.role}
            </span>
          </span>
          <ChevronDown
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link
            to="/profile"
            className={cn("cursor-pointer", isArabic && "font-arabic")}
          >
            <UserIcon className="me-2 h-4 w-4" aria-hidden="true" />
            {tLanding("nav.profile")}
          </Link>
        </DropdownMenuItem>
        {isAttendanceManager() && (
          <DropdownMenuItem asChild>
            <Link
              to="/admin/attendance/check-in"
              className={cn("cursor-pointer", isArabic && "font-arabic")}
            >
              <ScanLine className="me-2 h-4 w-4" aria-hidden="true" />
              {tAttendance("nav.checkIn")}
            </Link>
          </DropdownMenuItem>
        )}
        {getUserRole() === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link
              to="/admin/dashboard"
              className={cn("cursor-pointer", isArabic && "font-arabic")}
            >
              <LayoutDashboard className="me-2 h-4 w-4" aria-hidden="true" />
              {t("adminPanel")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          className={cn(
            "cursor-pointer text-brand-red",
            isArabic && "font-arabic",
          )}
        >
          <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
          {tLanding("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
