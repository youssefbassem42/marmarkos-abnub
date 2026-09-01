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
  const isLight = variant === "light";

  return (
    <aside
      dir="rtl"
      lang="ar"
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
            isLight && "bg-white shadow-[var(--shadow-card-strong)]",
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

        <BrandMessageHeading
          lang={lang}
          className={isLight ? "text-ink" : "text-white"}
        />

        <BrandSupportingLine
          lang={lang}
          className={isLight ? "text-ink/75" : "text-white/85"}
        />

        <img
          src={hero}
          alt=""
          aria-hidden="true"
          className="brush-mask mt-8 w-full max-w-md rounded-lg object-cover"
        />

        <BrandVerseBlock
          lang={lang}
          className="-mx-6 mt-10 max-w-md lg:-ms-12"
        />
      </div>
    </aside>
  );
}

interface BrandPieceProps {
  lang: "ar" | "en";
  className?: string;
}

/** FAITH. / FRIENDS. / PURPOSE. — shared by the auth panel and sidebar. */
export function BrandMessageHeading({ lang, className }: BrandPieceProps) {
  const { t } = useTranslation("common");
  const message = t("brand.message", {
    returnObjects: true,
  }) as readonly string[];

  return (
    <h1
      className={cn(
        "mt-3 font-heading text-4xl font-bold leading-snug lg:text-5xl",
        className,
      )}
    >
      {message[0]}
      <br />
      {message[1]}
      <br />
      <span className="text-mint">{message[2]}</span>
    </h1>
  );
}

/** The one-line mission statement under the message heading. */
export function BrandSupportingLine({ lang, className }: BrandPieceProps) {
  const { t } = useTranslation("common");

  return (
    <p
      className={cn(
        "mt-6 max-w-md leading-relaxed font-arabic text-xl",
        className,
      )}
    >
      {t("brand.supporting")}
    </p>
  );
}

/** Scripture quotation in Amiri with the mint reference. */
export function BrandVerseBlock({ lang, className }: BrandPieceProps) {
  const { t } = useTranslation("common");

  return (
    <figure
      className={cn("border-s-4 border-mint bg-navy px-6 py-6", className)}
    >
      <Quote className="h-6 w-6 fill-mint text-mint" aria-hidden="true" />
      <blockquote
        className={cn(
          "mt-3 font-verse leading-relaxed text-white text-2xl",
        )}
      >
        {t("brand.verse")}
      </blockquote>
      <figcaption className="mt-3 text-sm font-semibold tracking-wide text-mint">
        {t("brand.verseRef")}
      </figcaption>
    </figure>
  );
}
