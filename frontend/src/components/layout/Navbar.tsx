import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate } from "react-router-dom";
import logo from "@/assets/church-logo.png";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useLanguage } from "@/i18n/context";
import { logoutUser } from "@/lib/api";
import { clearAuth, getAccessToken, getAuthUser } from "@/lib/auth";
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

export function Navbar({ variant = "landing" }: { variant?: "landing" | "auth" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const isAuth = variant === "auth";
  // Read per render: remounts on every route change keep this fresh.
  const authenticated = Boolean(getAccessToken());
  const user = getAuthUser();

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
    setOpen(false);
    navigate("/");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "focus-ring rounded-sm pb-1 text-[15px] font-medium transition-colors hover:text-brand-blue",
      isArabic ? "font-arabic text-base" : "",
      isActive
        ? "border-b-2 border-brand-blue text-brand-blue"
        : "text-ink",
    );

  return (
    <header
      className={cn(
        "inset-x-0 top-0 z-50 border-b border-border/60 bg-background transition-shadow duration-300",
        isAuth ? "relative" : "fixed",
        scrolled ? "shadow-[0_2px_18px_rgba(37,61,99,0.10)]" : "",
      )}
    >
      <nav
        dir={isArabic ? "rtl" : "ltr"}
        lang={language}
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
            alt="إجتماع الشباب بأبنوب church logo"
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
                    <NavLink to={item.to} end={item.to === "/"} className={navLinkClass}>
                      {t(`nav.${item.key}`)}
                    </NavLink>
                  </li>
                ))}
              </ul>

              <Link
                to="/notifications"
                aria-label={t("nav.notifications")}
                className="focus-ring relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-secondary"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </Link>

              <LanguageToggle className="ml-1 hidden sm:inline-flex" />

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
                      <Link to="/profile" className={cn("cursor-pointer", isArabic && "font-arabic")}>
                        <UserIcon className="me-2 h-4 w-4" aria-hidden="true" />
                        {t("nav.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleSignOut()}
                      className={cn("cursor-pointer text-brand-red", isArabic && "font-arabic")}
                    >
                      <LogOut className="me-2 h-4 w-4" aria-hidden="true" />
                      {t("nav.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary ml-1 hidden px-6 py-2.5 text-sm sm:inline-flex"
                >
                  <span className={isArabic ? "font-arabic" : ""}>
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
              <LanguageToggle />
            </>
          )}
        </div>
      </nav>

      {open && !isAuth && (
        <div className="border-t border-border bg-background lg:hidden">
          <ul dir={isArabic ? "rtl" : "ltr"} className="mx-auto max-w-7xl px-5 py-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "focus-ring block rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary",
                    isArabic ? "font-arabic text-lg" : "",
                  )}
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className={cn(
                  "focus-ring flex items-center gap-2 rounded-lg px-2 py-3 text-base font-medium text-ink hover:bg-secondary",
                  isArabic ? "font-arabic text-lg" : "",
                )}
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {t("nav.notifications")}
              </Link>
            </li>
            <li className="flex items-center justify-between gap-3 pt-3 pb-4">
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
              {authenticated ? (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className={cn(
                    "btn-outline flex-1 justify-center py-3 text-brand-red",
                    isArabic ? "font-arabic" : "",
                  )}
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
                  <span className={isArabic ? "font-arabic" : ""}>
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
