import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeDate, formatWeekRange } from "@/lib/datetime";
import type { VerseCard } from "../types";

interface VerseHeroCardProps {
  verse: VerseCard;
}

export function VerseHeroCard({ verse }: VerseHeroCardProps) {
  const { t } = useTranslation("bible");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card card-elevated">
      {verse.image && (
        <img
          src={verse.image}
          alt={verse.title}
          className="h-48 w-full object-cover md:h-64"
        />
      )}
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {verse.week_start_date && (
            <span>{formatWeekRange(verse.week_start_date, "ar")}</span>
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={verse.published_at}>
            {formatRelativeDate(verse.published_at, "ar")}
          </time>
        </div>

        <h2
          className="mt-3 text-xl font-bold text-brand-blue md:text-2xl font-arabic"
        >
          {verse.title}
        </h2>

        <p
          dir="rtl"
          className="mt-1 font-verse text-sm italic text-muted-foreground not-italic font-arabic text-base"
        >
          {verse.verse_reference}
        </p>

        <p
          dir="rtl"
          className="mt-3 line-clamp-3 font-verse text-[15px] leading-7 text-ink not-italic font-arabic text-base leading-8"
        >
          {verse.excerpt}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {verse.is_read && (
            <Badge variant="secondary">{t("list.readBadge")}</Badge>
          )}
          {verse.has_quiz && (
            <Badge variant="outline">{t("list.quizBadge")}</Badge>
          )}
        </div>

        <Button asChild className="mt-5">
          <Link to={`/bible-verses/${verse.id}`}>
            {t("list.readMore")}
            <ArrowRight className="h-4 w-4 rtl:hidden" aria-hidden="true" />
            <ArrowRight
              className="hidden h-4 w-4 rotate-180 rtl:block"
              aria-hidden="true"
            />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export function VerseHeroCardSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card card-elevated">
      <Skeleton className="h-48 w-full md:h-64" />
      <div className="space-y-3 p-5 md:p-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    </section>
  );
}
