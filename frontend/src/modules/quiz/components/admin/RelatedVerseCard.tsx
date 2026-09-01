import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVerse } from "@/modules/bible/hooks/useVerse";

interface RelatedVerseCardProps {
  verseId: string;
}

export function RelatedVerseCard({ verseId }: RelatedVerseCardProps) {
  const { t } = useTranslation("quiz");
  const { data: verse, isLoading } = useVerse(verseId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (!verse) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          {t("admin.manage.relatedVerse")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="font-medium">{verse.title}</p>
          <p className="text-sm text-muted-foreground">
            {verse.verse_reference}
          </p>
        </div>
        <Link
          to={`/admin/bible-verses/${verse.id}/edit`}
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("admin.manage.viewVerse")}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
