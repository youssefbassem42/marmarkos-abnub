import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useLanguage } from "@/i18n/context";
import { logoutUser } from "@/lib/api";
import { clearAuth, getAuthUser } from "@/lib/auth";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AdminTopbarProps {
  title?: string;
  subtitle?: string;
}

/**
 * The admin header row from the check-in design: hamburger → page title
 * + subtitle → spacer → notification bell (disabled, no badge — the
 * notifications module is Phase 4) → avatar menu → language → theme.
 */
export function AdminTopbar({ title, subtitle }: AdminTopbarProps) {
  const { t } = useTranslation("common");
  const { t: tLanding } = useTranslation("landing");
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();
  const user = getAuthUser();

  const handleSignOut = async () => {
    await logoutUser();
    clearAuth();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background">
      <div
        dir={isArabic ? "rtl" : "ltr"}
        lang={language}
        className="flex items-center gap-3 px-5 py-3 lg:px-8"
      >
        <SidebarTrigger aria-label="Toggle sidebar" />

        <div className="min-w-0">
          {title ? (
            <h1
              className={cn(
                "truncate font-heading text-2xl font-bold text-ink",
                isArabic && "font-arabic",
              )}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p
              className={cn(
                "truncate text-sm text-muted-foreground",
                isArabic && "font-arabic",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("comingSoon")}
            aria-label={tLanding("nav.notifications")}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground opacity-50 cursor-not-allowed"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>

          <ThemeToggle className="hidden sm:inline-flex" />
          <LanguageToggle className="hidden sm:inline-flex" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="focus-ring flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-secondary"
              >
                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-navy text-sm font-bold text-white">
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
        </div>
      </div>
    </header>
  );
}
