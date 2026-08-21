import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import logo from "@/assets/church-logo.png";
import { LanguageToggle } from "./LanguageToggle";
import { useLanguage } from "@/i18n/context";
import { getAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const linkKeys = [
  "home",
  "about",
  "ministries",
  "events",
  "gallery",
  "contact",
] as const;

interface NavbarProps {
  /** "landing" = full site nav (default); "auth" = compact bar whose logo returns to the landing page */
  variant?: "landing" | "auth";
}

export function Navbar({ variant = "landing" }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const isAuth = variant === "auth";
  const authenticated = Boolean(getAccessToken());

  useEffect(() => {
    if (isAuth) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isAuth]);

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
        {isAuth ? (
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
              className="h-12 w-auto"
            />
          </Link>
        ) : (
          <a
            href="#home"
            className="flex min-w-0 items-center gap-2 focus-ring rounded-md"
          >
            <img
              src={logo}
              alt="إجتماع الشباب بأبنوب church logo"
              width={112}
              height={78}
              className="h-14 w-auto"
            />
            <span className="sr-only">
              إجتماع الشباب بأبنوب — Youth Service
            </span>
          </a>
        )}

        <div className="flex items-center gap-2">
          {!isAuth && (
            <>
              <ul className="hidden items-center gap-7 lg:flex">
                {linkKeys.map((key, i) => (
                  <li key={key}>
                    <a
                      href={`#${key}`}
                      className={cn(
                        "focus-ring rounded-sm pb-1 text-[15px] font-medium transition-colors hover:text-brand-blue",
                        isArabic ? "font-arabic text-base" : "",
                        i === 0
                          ? "border-b-2 border-brand-blue text-brand-blue"
                          : "text-navy",
                      )}
                    >
                      {t(`nav.${key}`)}
                    </a>
                  </li>
                ))}
              </ul>

              <LanguageToggle className="ml-2 hidden sm:inline-flex" />

              {authenticated ? (
                <Link
                  to="/profile"
                  className="btn-primary ml-2 hidden px-6 py-2.5 text-sm sm:inline-flex"
                >
                  <span className={isArabic ? "font-arabic" : ""}>
                    {t("nav.profile")}
                  </span>
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary ml-2 hidden px-6 py-2.5 text-sm sm:inline-flex"
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
                className="focus-ring inline-flex h-11 w-11 items-center justify-center rounded-xl text-navy lg:hidden"
              >
                {open ? <X /> : <Menu />}
              </button>
            </>
          )}

          {isAuth && <LanguageToggle />}
        </div>
      </nav>

      {open && !isAuth && (
        <div className="border-t border-border bg-background lg:hidden">
          <ul
            dir={isArabic ? "rtl" : "ltr"}
            className="mx-auto max-w-7xl px-5 py-3"
          >
            {linkKeys.map((key) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "focus-ring block rounded-lg px-2 py-3 text-base font-medium text-navy hover:bg-secondary",
                    isArabic ? "font-arabic text-lg" : "",
                  )}
                >
                  {t(`nav.${key}`)}
                </a>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 pt-3 pb-4">
              <LanguageToggle />
              {authenticated ? (
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  <span className={isArabic ? "font-arabic" : ""}>
                    {t("nav.profile")}
                  </span>
                </Link>
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
