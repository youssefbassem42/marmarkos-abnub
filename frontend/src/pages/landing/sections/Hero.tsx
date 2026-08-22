import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import hero from "@/assets/hero-worship.jpg";
import { YouthFigure } from "./YouthFigure";

export function Hero() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");
  const titleLines = tCommon("brand.message", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <section id="home" className="relative overflow-hidden pt-24 lg:pt-28">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-14 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)] lg:gap-6 lg:px-8 lg:pb-20">
        <div className="reveal">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
            {t("hero.eyebrow")}
          </p>
          <h1
            dir={isArabic ? "rtl" : "ltr"}
            className={`mt-3 text-[clamp(2.6rem,9vw,4.6rem)] font-extrabold leading-[0.98] tracking-tight text-ink ${
              isArabic ? "font-arabic" : ""
            }`}
          >
            {titleLines.map((line, i) =>
              i === titleLines.length - 1 ? (
                <span key={line} className="text-mint">
                  {line}
                </span>
              ) : (
                <span key={line}>
                  {line}
                  <br />
                </span>
              ),
            )}
          </h1>
          <p
            dir="rtl"
            lang="ar"
            className="font-arabic mt-4 w-fit text-2xl font-bold text-ink lg:text-3xl"
          >
            إجتماع الشباب بأبنوب
          </p>
          <p
            className={`mt-5 max-w-md text-[15px] leading-7 text-muted-foreground ${
              isArabic ? "font-arabic text-lg leading-8" : ""
            }`}
          >
            {tCommon("brand.supporting")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#events" className="btn-primary px-6 py-3.5 text-sm">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span className={isArabic ? "font-arabic" : ""}>
                {t("hero.ctaPrimary")}
              </span>
            </a>
            <a href="#about" className="btn-outline px-6 py-3.5 text-sm">
              <span className={isArabic ? "font-arabic" : ""}>
                {t("hero.ctaSecondary")}
              </span>
            </a>
          </div>
        </div>

        <div className="relative reveal">
          <img
            src={hero}
            alt={
              isArabic
                ? "شباب يعبدون بأيدي مرفوعة بجانب صليب مضيء عند الغروب"
                : "Young people worshipping with raised hands beside a glowing cross at sunset"
            }
            width={1200}
            height={912}
            className="brush-mask w-full object-cover"
          />
          <YouthFigure
            className="absolute -left-2 bottom-[-6%] h-32 w-auto drop-shadow-sm sm:h-40 lg:h-48"
            color="var(--brand-blue)"
          />
          <YouthFigure
            className="absolute right-[2%] top-[-6%] h-24 w-auto sm:h-28 lg:h-32"
            color="var(--brand-orange)"
            flip
          />
        </div>
      </div>
    </section>
  );
}
