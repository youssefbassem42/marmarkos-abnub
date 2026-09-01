import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VerseBodyProps {
  text: string;
  verseReference: string;
  reflection: string;
}

export function VerseBody({ text, verseReference, reflection }: VerseBodyProps) {
  const { t } = useTranslation("bible");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 text-center card-elevated">
        <Quote
          className="mx-auto h-6 w-6 fill-brand-blue text-brand-blue opacity-60"
          aria-hidden="true"
        />
        <blockquote
          dir="rtl"
          className="mt-3 font-verse text-lg italic leading-8 text-brand-blue md:text-xl md:leading-9 not-italic font-arabic text-xl md:text-2xl md:leading-10"
        >
          {text}
        </blockquote>
        <p
          dir="rtl"
          className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-blue font-arabic normal-case tracking-normal"
        >
          {verseReference}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 card-elevated">
        <h2
          className="text-base font-bold text-ink font-arabic text-lg"
        >
          {t("detail.reflection")}
        </h2>
        <div
          className={cn(
            "relative mt-3 font-verse text-sm leading-7 text-ink/80 whitespace-pre-line not-italic font-arabic text-base leading-8",
            !expanded && "line-clamp-4",
          )}
        >
          {reflection}
        </div>
        <Button
          variant="link"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 h-auto p-0 text-brand-orange"
        >
          {expanded ? t("detail.readMore") : t("detail.readMore")}
        </Button>
      </section>
    </div>
  );
}
