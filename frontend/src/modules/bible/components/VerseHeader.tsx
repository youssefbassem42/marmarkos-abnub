import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/datetime";
import type { VerseDetailResponse } from "../types";

interface VerseHeaderProps {
  verse: VerseDetailResponse;
}

export function VerseHeader({ verse }: VerseHeaderProps) {
  const { t } = useTranslation("bible");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card card-elevated">
      {verse.image && (
        <img
          src={verse.image}
          alt={verse.title}
          className="h-56 w-full object-cover md:h-72"
        />
      )}
      <div className="p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{t("detail.weeklyVerse")}</Badge>
          {verse.published_at && (
            <time
              dateTime={verse.published_at}
              className="text-xs text-muted-foreground font-arabic"
            >
              {t("detail.publishedOn", {
                date: formatRelativeDate(verse.published_at, "ar"),
              })}
            </time>
          )}
        </div>
        <h1
          className="mt-3 text-2xl font-bold text-ink md:text-3xl font-arabic"
        >
          {verse.title}
        </h1>
      </div>
    </div>
  );
}
