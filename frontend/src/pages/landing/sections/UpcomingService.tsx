import { CalendarDays, Clock, MapPin, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function UpcomingService() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");

  return (
    <section id="events" className="bg-navy py-14 text-white lg:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:gap-10 lg:px-8">
        <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-white text-ink shadow-lg lg:h-28 lg:w-28">
          <CalendarDays className="h-12 w-12" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mint">
            {t("upcoming.eyebrow")}
          </p>
          <h2
            className={cn(
              "mt-2 text-[clamp(1.7rem,4vw,2.2rem)] font-extrabold tracking-tight",
              isArabic ? "font-arabic" : "",
            )}
          >
            {t("upcoming.heading")}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px]">
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-mint" aria-hidden="true" />{" "}
              <span className={isArabic ? "font-arabic" : ""}>
                {t("upcoming.time")}
              </span>
            </span>
            <span className="hidden h-5 w-px bg-white/25 sm:block" />
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-mint" aria-hidden="true" />{" "}
              <span className={isArabic ? "font-arabic" : ""}>
                {t("upcoming.location")}
              </span>
            </span>
          </div>
          <p
            className={cn(
              "mt-4 text-sm leading-6 text-white/85",
              isArabic ? "font-arabic text-base leading-7" : "",
            )}
          >
            {t("upcoming.line1")}
            <br />
            {t("upcoming.line2")}
          </p>
        </div>

        <a
          href="#contact"
          className="focus-ring inline-flex items-center justify-center gap-3 rounded-xl bg-mint px-7 py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:-translate-y-0.5"
        >
          <span className={isArabic ? "font-arabic" : ""}>
            {t("upcoming.cta")}
          </span>
          <ArrowRight
            className={cn("h-4 w-4", isArabic && "-scale-x-100")}
            aria-hidden="true"
          />
        </a>
      </div>
    </section>
  );
}
