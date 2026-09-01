import { useEffect, useState } from "react";
import {
  Bell,
  CalendarCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  ScanLine,
  User as UserIcon,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "@/assets/church-logo.png";
import { ThemeToggle } from "./ThemeToggle";

import { NotificationBell } from "@/modules/notifications/components/NotificationBell";
import { MobileBellBadge } from "@/modules/notifications/components/MobileBellBadge";
import { notificationKeys } from "@/modules/notifications/api/queryKeys";
import { logoutUser } from "@/lib/api";
import {
  clearAuth,
  getAccessToken,
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

interface NavItem {
  key: "home" | "anonymous" | "blog" | "gallery" | "aboutUs";
  to: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "home", to: "/" },
  { key: "anonymous", to: "/anonymous-messages" },
  { key: "blog", to: "/blog" },
  { key: "gallery", to: "/gallery" },
  { key: "aboutUs", to: "/about-us" },
];

export function Navbar({
  variant = "landing",
}: {
  variant?: "landing" | "auth";
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  const { t: tAttendance } = useTranslation("attendance");
  const { t: tBible } = useTranslation("bible");
  const { t: tPoints } = useTranslation("points");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAuth = variant === "auth";
  // Read per render: remounts on every route change keep this fresh.
  const authenticated = Boolean(getAccessToken());
  const user = getAuthUser();
  const attendanceManager = isAttendanceManager();

  useEffect(() => {
    if (isAuth) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isAuth]);

  const handleSignOut = async () => {
    await logoutUser();
    clearAuth();
    // DEF-16 (scoped): a second user on this browser must never see the
    // first user's unread count.
    queryClient.removeQueries({ queryKey: notificationKeys.all });
    setOpen(false);
    navigate("/");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "focus-ring rounded-sm pb-1 text-[15px] font-medium transition-colors hover:text-brand-blue",
      "font-arabic text-base",
      isActive ? "border-b-2 border-brand-blue text-brand-blue" : "text-ink",
    );

  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-50 border-b border-border/60 bg-background transition-shadow duration-300",
        isAuth ? "relative" : "fixed",
        scrolled ? "shadow-[var(--shadow-card-strong)]" : "",
      )}
    >
      <nav
        dir="rtl"
        lang="ar"
        className={cn(
          "mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 lg:px-8",
          isAuth ? "py-2.5" : "py-3",
        )}
      >
        <Link
          to="/"
          aria-label={t("nav.home")}
          className="flex min-w-0 items-center gap-2 focus-ring rounded-md"
        >
          <img
            src={logo}
            alt={tCommon("brand.logoAlt")}
            width={112}
            height={78}
            className="h-14 w-auto"
          />
        </Link>

        <div className="flex items-center gap-2">
          {!isAuth && (
            <>
              <ul className="hidden items-center gap-6 lg:flex">
                {NAV_ITEMS.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={navLinkClass}
                    >
                      {t(`nav.${item.key}`)}
                    </NavLink>
                  </li>
                ))}
                {attendanceManager && (
                  <li>
                    <NavLink
                      to="/admin/attendance/check-in"
                      className={navLinkClass}
                    >
                      {tAttendance("nav.checkIn")}
                    </NavLink>
                  </li>
                )}
                {authenticated && (
                  <>
                    <li>
                      <NavLink to="/bible-verses" className={navLinkClass}>
                        {tBible("list.title")}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/points" className={navLinkClass}>
                        {tPoints("page.title")}
                      </NavLink>
                    </li>
                  </>
                )}
              </ul>

              <NotificationBell to="/notifications" />

              <ThemeToggle className="hidden sm:inline-flex" />

              {authenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("nav.profile")}
                      className="focus-ring ms-1 grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-border shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-navy text-sm font-bold text-white">
                          {(user?.first_name ?? "?")[0].toUpperCase()}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link
                        to="/profile"
                        className="cursor-pointer font-arabic"
                      >
                        <UserIcon className="me-2 h-4 w-4" aria-hidden="true" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    {attendanceManager && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/admin/attendance/check-in"
                          className="cursor-pointer font-arabic"
                        >
                          <ScanLine
                            className="me-2 h-4 w-4"
                            aria-hidden="true"
                          />
                          {tAttendance("nav.checkIn")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {getUserRole() === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link
                          to="/admin/dashboard"
                          className="cursor-pointer font-arabic"
                        >
                          <LayoutDashboard
                            className="me-2 h-4 w-4"
                            aria-hidden="true"
                          />
                          {tCommon("adminPanel")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => void handleSignOut()}
                      className="cursor-pointer text-brand-red font-arabic"
                    >
                      <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("nav.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary ms-1 hidden px-6 py-2.5 text-sm sm:inline-flex"
                >
                  <span className="font-arabic">
                    {t("nav.login")}
                  </span>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink lg:hidden"
              >
                {open ? <X /> : <Menu />}
              </button>
            </>
          )}

          {isAuth && (
            <>
              <ThemeToggle />
            </>
          )}
        </div>
      </nav>

      {open && !isAuth && (
        <div className="border-t border-border bg-background lg:hidden">
          <ul
            dir="rtl"
            className="mx-auto max-w-7xl px-5 py-3"
          >
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="focus-ring block rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary font-arabic text-lg"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
            {attendanceManager && (
              <li>
                <Link
                  to="/admin/attendance/check-in"
                  onClick={() => setOpen(false)}
                  className="focus-ring flex items-center gap-2 rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary font-arabic text-lg"
                >
                  <CalendarCheck className="h-5 w-5" aria-hidden="true" />
                  {tAttendance("nav.checkIn")}
                </Link>
              </li>
            )}
            {authenticated && (
              <>
                <li>
                  <Link
                    to="/bible-verses"
                    onClick={() => setOpen(false)}
                    className="focus-ring block rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary font-arabic text-lg"
                  >
                    {tBible("list.title")}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/points"
                    onClick={() => setOpen(false)}
                    className="focus-ring block rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary font-arabic text-lg"
                  >
                    {tPoints("page.title")}
                  </Link>
                </li>
              </>
            )}
            <li>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="focus-ring flex items-center gap-2 rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary font-arabic text-lg"
              >
                <span className="relative inline-flex">
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  <MobileBellBadge />
                </span>
                {t("nav.notifications")}
              </Link>
            </li>
            <li className="flex items-center justify-between gap-3 pt-3 pb-4">
              <div className="flex items-center gap-2">
                <ThemeToggle />
              </div>
              {authenticated ? (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="btn-outline flex-1 justify-center py-3 text-brand-red font-arabic"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t("nav.signOut")}
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  <span className="font-arabic">
                    {t("nav.login")}
                  </span>
                </Link>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
