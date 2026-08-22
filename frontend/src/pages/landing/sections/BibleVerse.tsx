import { Quote, Church } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function BibleVerse() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { t } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");

  return (
    <section id="gallery" className="bg-soft py-14 lg:py-16">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-3 lg:px-8">
        <figure className="reveal flex gap-3">
          <Quote
            className="h-7 w-7 shrink-0 fill-mint text-mint"
            aria-hidden="true"
          />
          <div>
            <blockquote
              dir={isArabic ? "rtl" : "ltr"}
              className={cn(
                "text-[15px] font-medium italic leading-7 text-brand-blue",
                isArabic && "font-arabic not-italic text-lg leading-8",
              )}
            >
              {tCommon("brand.verse")}
            </blockquote>
            <figcaption className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-mint">
              {tCommon("brand.verseRef")}
            </figcaption>
          </div>
        </figure>

        <div className="flex justify-center">
          <span className="grid h-32 w-32 place-items-center rounded-full bg-navy text-white">
            <Church className="h-16 w-16" aria-hidden="true" />
          </span>
        </div>

        <div
          dir={isArabic ? "rtl" : "ltr"}
          className={cn("reveal", isArabic && "text-right")}
        >
          <h2
            className={cn(
              "text-xl font-extrabold tracking-tight text-ink",
              isArabic ? "font-arabic text-2xl" : "",
            )}
          >
            {t("bibleVerse.heading")}
          </h2>
          <p
            className={cn(
              "mt-3 text-[15px] leading-7 text-muted-foreground",
              isArabic ? "font-arabic text-base leading-8" : "",
            )}
          >
            {t("bibleVerse.line1")}
            <br />
            {t("bibleVerse.line2")}
          </p>
          <p
            className={cn(
              "mt-3 font-extrabold text-brand-blue",
              isArabic ? "font-arabic text-lg" : "text-[15px]",
            )}
          >
            {t("bibleVerse.accent")}
          </p>
        </div>
      </div>
    </section>
  );
}
