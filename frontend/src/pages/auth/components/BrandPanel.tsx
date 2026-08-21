import { useTranslation } from "react-i18next";
import { Cross, Quote } from "lucide-react";
import logo from "@/assets/church-logo.png";
import { cn } from "@/lib/utils";

interface BrandPanelProps {
  lang: "ar" | "en";
}

export function BrandPanel({ lang }: BrandPanelProps) {
  const { t } = useTranslation("common");
  const isArabic = lang === "ar";
  const message = t("brand.message", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <aside
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className="relative flex w-full flex-col justify-center overflow-hidden bg-navy px-6 py-12 text-white lg:w-1/2 lg:px-12 lg:py-16"
    >
      <div
        className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-brand-blue/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-20 -end-20 h-64 w-64 rounded-full bg-mint/10 blur-3xl"
        aria-hidden="true"
      />
      <Cross
        className="pointer-events-none absolute -bottom-16 -end-16 h-56 w-56 text-white/5"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="flex h-20 w-28 items-center justify-center">
          <img
            src={logo}
            alt={t("brand.logoAlt")}
            width={112}
            height={80}
            className="h-20 w-full object-contain brightness-0 invert"
          />
        </div>

        <h1 className="mt-8 font-heading text-4xl font-bold leading-snug text-white">
          {t("brand.name")}
          {isArabic && <span className="text-mint"> بأبنوب</span>}
        </h1>

        <p className="mt-8 font-heading text-3xl font-semibold leading-relaxed">
          {message.map((word, index) => (
            <span
              key={word}
              className={
                index === message.length - 1 ? "text-mint" : "text-white"
              }
            >
              {word}{" "}
            </span>
          ))}
        </p>

        <p
          className={cn(
            "mt-6 max-w-md leading-relaxed text-white/85",
            isArabic ? "font-arabic text-xl" : "text-lg",
          )}
        >
          {t("brand.supporting")}
        </p>

        <figure className="mt-10 max-w-md border-s-4 border-mint ps-5">
          <Quote className="h-6 w-6 fill-mint text-mint" aria-hidden="true" />
          <blockquote
            className={cn(
              "mt-3 font-verse leading-relaxed text-white",
              isArabic ? "text-2xl" : "text-xl",
            )}
          >
            {t("brand.verse")}
          </blockquote>
          <figcaption className="mt-3 text-sm font-semibold tracking-wide text-mint">
            {t("brand.verseRef")}
          </figcaption>
        </figure>
      </div>
    </aside>
  );
}
