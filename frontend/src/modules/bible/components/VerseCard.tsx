import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/datetime";
import type { VerseCard as VerseCardType } from "../types";

interface VerseCardProps {
  verse: VerseCardType;
}

export function VerseCard({ verse }: VerseCardProps) {
  const { t } = useTranslation("bible");

  return (
    <Link
      to={`/bible-verses/${verse.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:bg-secondary/60 card-elevated"
    >
      {verse.image && (
        <img
          src={verse.image}
          alt={verse.title}
          className="h-36 w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
      )}
      <div className="p-4">
        <h3
          className="text-base font-bold text-ink line-clamp-1 font-arabic"
        >
          {verse.title}
        </h3>
        <p
          dir="rtl"
          className="mt-1 font-verse text-xs italic text-muted-foreground not-italic font-arabic text-sm"
        >
          {verse.verse_reference}
        </p>
        <p
          dir="rtl"
          className="mt-2 line-clamp-2 font-verse text-sm leading-6 text-ink/80 not-italic font-arabic text-base leading-7"
        >
          {verse.reflection}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <time
            dateTime={verse.published_at}
            className="text-xs text-muted-foreground"
          >
            {formatRelativeDate(verse.published_at, "ar")}
          </time>
          <div className="flex gap-1.5">
            {verse.read && (
              <Badge variant="secondary" className="text-[10px]">
                {t("list.readBadge")}
              </Badge>
            )}
            {verse.has_quiz && (
              <Badge variant="outline" className="text-[10px]">
                {t("list.quizBadge")}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function VerseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card card-elevated">
      <div className="h-36 w-full bg-primary/10 animate-pulse" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 rounded bg-primary/10 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-primary/10 animate-pulse" />
        <div className="h-10 w-full rounded bg-primary/10 animate-pulse" />
        <div className="flex justify-between">
          <div className="h-3 w-16 rounded bg-primary/10 animate-pulse" />
          <div className="flex gap-1.5">
            <div className="h-4 w-12 rounded bg-primary/10 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
