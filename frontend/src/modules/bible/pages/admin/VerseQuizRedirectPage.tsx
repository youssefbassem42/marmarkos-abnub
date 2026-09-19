import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useQuizByVerse } from "@/modules/quiz/hooks/useQuizByVerse";

/**
 * Smart handler for the per-verse "Quiz" action in the verse listing.
 * If the verse already has a quiz, opens its builder; otherwise it
 * pre-creates a new quiz with that verse preselected.
 */
export default function VerseQuizRedirectPage() {
  const { verseId = "" } = useParams<{ verseId: string }>();
  const { t } = useTranslation("bible");
  const navigate = useNavigate();
  const { data: quiz, isLoading, isError, error } = useQuizByVerse(verseId);

  useEffect(() => {
    if (isLoading) return;
    if (isError) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? (error as { status?: number }).status
          : undefined;
      if (status === 404) {
        navigate(`/admin/quizzes/new?verseId=${encodeURIComponent(verseId)}`, {
          replace: true,
        });
      } else {
        navigate("/admin/quizzes", { replace: true });
      }
      return;
    }
    if (quiz) {
      navigate(`/admin/quizzes/${quiz.id}/builder`, { replace: true });
    }
  }, [quiz, isLoading, isError, error, navigate, verseId]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
      <p className="text-sm font-arabic">{t("admin.verseQuiz.redirecting")}</p>
    </div>
  );
}