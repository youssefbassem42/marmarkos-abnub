import { useTranslation } from "react-i18next";
import { Cross, Quote } from "lucide-react";
import logo from "@/assets/church-logo.png";
import hero from "@/assets/hero-worship.jpg";
import { cn } from "@/lib/utils";

interface BrandPanelProps {
  lang: "ar" | "en";
  /** Auth pages use the navy panel; the attendance layout uses light. */
  variant?: "navy" | "light";
  className?: string;
}

export function BrandPanel({
  lang,
  variant = "navy",
  className,
}: BrandPanelProps) {
  const { t } = useTranslation("common");
  const isArabic = lang === "ar";
  const isLight = variant === "light";
  const message = t("brand.message", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <aside
      dir={isArabic ? "rtl" : "ltr"}
      lang={lang}
      className={cn(
        "relative flex w-full flex-col justify-center overflow-hidden px-6 py-12 lg:px-12 lg:py-16",
        isLight ? "bg-background" : "bg-navy text-white",
        className,
      )}
    >
      {!isLight && (
        <>
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
        </>
      )}

      <div className="relative">
        <div
          className={cn(
            "flex h-20 w-28 items-center justify-center rounded-xl",
            isLight && "bg-white shadow-[0_2px_18px_rgba(37,61,99,0.12)]",
          )}
        >
          <img
            src={logo}
            alt={t("brand.logoAlt")}
            width={112}
            height={80}
            className={cn(
              "h-20 w-full object-contain",
              !isLight && "brightness-0 invert",
            )}
          />
        </div>

        <p
          className={cn(
            "mt-8 font-heading text-sm font-bold uppercase tracking-widest text-mint",
          )}
        >
          {t("brand.name")}
        </p>

        <h1
          className={cn(
            "mt-3 font-heading text-4xl font-bold leading-snug lg:text-5xl",
            isLight ? "text-ink" : "text-white",
          )}
        >
          {isArabic ? (
            <>
              {message[0]}
              <br />
              {message[1]}
              <br />
              <span className="text-mint">{message[2]}</span>
            </>
          ) : (
            message.map((word, index) => (
              <span
                key={word}
                className={
                  index === message.length - 1 ? "text-mint" : undefined
                }
              >
                {word}{" "}
              </span>
            ))
          )}
        </h1>

        <p
          className={cn(
            "mt-6 max-w-md leading-relaxed",
            isLight ? "text-ink/75" : "text-white/85",
            isArabic ? "font-arabic text-xl" : "text-lg",
          )}
        >
          {t("brand.supporting")}
        </p>

        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="brush-mask mt-8 w-full max-w-md rounded-lg object-cover"
        />

        <figure
          className={cn(
            "-mx-6 mt-10 max-w-md border-s-4 border-mint bg-navy px-6 py-6 lg:-ms-12",
          )}
        >
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
