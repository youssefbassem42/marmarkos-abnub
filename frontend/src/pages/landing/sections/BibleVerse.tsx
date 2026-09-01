import { Quote, Church } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function BibleVerse() {
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
              dir="rtl"
              className={cn(
                "font-verse text-[15px] font-medium italic leading-7 text-brand-blue not-italic text-lg leading-8",
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

        <div dir="rtl" className={cn("reveal")}>
          <h2
            className={cn(
              "text-xl font-extrabold tracking-tight text-ink font-arabic text-2xl",
            )}
          >
            {t("bibleVerse.heading")}
          </h2>
          <p
            className={cn(
              "mt-3 text-[15px] leading-7 text-muted-foreground font-arabic text-base leading-8",
            )}
          >
            {t("bibleVerse.line1")}
            <br />
            {t("bibleVerse.line2")}
          </p>
          <p
            className={cn(
              "mt-3 font-extrabold text-brand-blue font-arabic text-lg",
            )}
          >
            {t("bibleVerse.accent")}
          </p>
        </div>
      </div>
    </section>
  );
}
