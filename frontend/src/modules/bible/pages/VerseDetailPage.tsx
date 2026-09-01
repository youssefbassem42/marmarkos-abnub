import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ErrorRetry } from "@/components/common/ErrorRetry";
import { useVerse } from "../hooks/useVerse";
import { useRecordOpen } from "../hooks/useRecordOpen";
import { useMarkAsRead } from "../hooks/useMarkAsRead";
import { VerseHeader } from "../components/VerseHeader";
import { VerseBody } from "../components/VerseBody";
import { MarkAsReadButton } from "../components/MarkAsReadButton";
import { QuizTeaserCard } from "../components/QuizTeaserCard";

export default function VerseDetailPage() {
  const { verseId } = useParams<{ verseId: string }>();
  const { t } = useTranslation("bible");

  const verse = useVerse(verseId!);
  const markAsRead = useMarkAsRead();

  useRecordOpen(verseId);

  if (verse.isError) {
    return (
      <div dir="rtl" lang="ar" className="space-y-6">
        <ErrorRetry onRetry={verse.refetch} />
      </div>
    );
  }

  if (verse.isLoading) {
    return (
      <div dir="rtl" lang="ar" className="space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const data = verse.data!;

  return (
    <div dir="rtl" lang="ar" className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="gap-1 font-arabic"
      >
        <Link to="/bible-verses">
          <ArrowLeft
            className="h-4 w-4 rtl:hidden"
            aria-hidden="true"
          />
          <ArrowLeft
            className="hidden h-4 w-4 rotate-180 rtl:block"
            aria-hidden="true"
          />
          {t("detail.back")}
        </Link>
      </Button>

      <VerseHeader verse={data} />

      <VerseBody
        text={data.text}
        verseReference={data.verse_reference}
        reflection={data.reflection}
      />

      <MarkAsReadButton
        isRead={data.read}
        onMarkAsRead={() => markAsRead.mutate(data.id)}
        isPending={markAsRead.isPending}
      />

      {data.quiz && (
        <QuizTeaserCard
          quiz={data.quiz}
          isRead={data.read}
          attemptStatus={null}
        />
      )}
    </div>
  );
}
