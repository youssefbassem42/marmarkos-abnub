import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, toApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartAttempt } from "../hooks/useStartAttempt";
import { useAttempt } from "../hooks/useAttempt";
import { useQuizForTake } from "../hooks/useQuizForTake";
import { useSaveAnswer } from "../hooks/useSaveAnswer";
import { useSubmitAttempt } from "../hooks/useSubmitAttempt";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useQuizTimer } from "../hooks/useQuizTimer";
import { QuizTimer } from "../components/QuizTimer";
import { QuestionCard } from "../components/QuestionCard";
import { QuizProgressDots } from "../components/QuizProgressDots";
import { AutosaveIndicator } from "../components/AutosaveIndicator";
import { TimesUpPanel } from "../components/TimesUpPanel";

type SaveStatus = "idle" | "saving" | "saved" | "failed";

const ANNOUNCE_SECONDS = [60, 30, 10];

export default function QuizAttemptPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const { t } = useTranslation("quiz");
  const { t: tCommon } = useTranslation("common");
  const navigate = useNavigate();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // Server-anchored active-time budget from heartbeat/save responses (V2).
  const [budgetAnchor, setBudgetAnchor] = useState<{
    remainingSeconds: number;
    serverTime: string;
  } | null>(null);
  const announcedRef = useRef(new Set<number>());
  const startAttemptTriggeredRef = useRef(false);

  const startAttempt = useStartAttempt();
  const { data: attempt, isLoading: attemptLoading } = useAttempt(
    attemptId ?? "",
    { enabled: !!attemptId },
  );
  const { data: takeData, isLoading: takeLoading } = useQuizForTake(
    quizId ?? "",
    { enabled: !!quizId },
  );
  const saveAnswer = useSaveAnswer();
  const submitAttempt = useSubmitAttempt();

  const questions = takeData?.questions ?? [];

  const timerRemaining =
    budgetAnchor?.remainingSeconds ?? attempt?.remaining_seconds ?? 0;
  const timerServerTime =
    budgetAnchor?.serverTime ??
    attempt?.server_time ??
    new Date().toISOString();
  const answersLocked =
    hasSubmitted || (attemptId != null && attempt?.status !== "IN_PROGRESS");

  const timer = useQuizTimer({
    remainingSeconds: timerRemaining,
    serverTime: timerServerTime,
  });

  useHeartbeat({
    attemptId: attemptId ?? "",
    enabled: !!attemptId && attempt?.status === "IN_PROGRESS",
    onAnchor: (body) =>
      setBudgetAnchor({
        remainingSeconds: body.remaining_seconds,
        serverTime: body.server_time,
      }),
  });

  // A fresh resume payload is already server-anchored; drop any older anchor.
  useEffect(() => {
    setBudgetAnchor(null);
  }, [attempt?.id]);

  // Start attempt on mount if we have quizId but no attemptId
  useEffect(() => {
    if (!quizId) return;
    if (attemptId) return;
    if (startAttemptTriggeredRef.current) return;

    startAttemptTriggeredRef.current = true;
    startAttempt.mutate(quizId, {
      onSuccess: (data) => {
        setAttemptId(data.id);
        const initial: Record<string, string> = {};
        data.questions.forEach((q) => {
          if (q.selected_option_id) initial[q.id] = q.selected_option_id;
        });
        setSelectedMap(initial);
      },
    });
  }, [quizId, attemptId, startAttempt]);

  // Redirect if attempt already completed
  useEffect(() => {
    if (!attempt) return;
    if (attempt.status === "COMPLETED" || attempt.status === "AUTO_FINISHED") {
      navigate(`/quizzes/${quizId}/result?attemptId=${attempt.id}`);
      return;
    }
    // Resume (in-progress): restore the user's saved selections.
    const resumeQuestions = attempt.questions;
    if (resumeQuestions?.length) {
      setSelectedMap((prev) => {
        const merged = { ...prev };
        for (const q of resumeQuestions) {
          if (q.selected_option_id) merged[q.id] = q.selected_option_id;
        }
        return merged;
      });
    }
  }, [attempt, quizId, navigate]);

  // A user who has already started/done this quiz gets the existing attempt
  // back via 409 attempt_exists. Load its id so the page resumes (in-progress)
  // or bounces to the result page (completed, via the effect above).
  useEffect(() => {
    if (!startAttempt.isError || attemptId) return;
    const err = toApiError(startAttempt.error);
    if (
      err instanceof ApiError &&
      err.code === "attempt_exists" &&
      typeof err.data?.attempt_id === "string"
    ) {
      setAttemptId(err.data.attempt_id);
    }
  }, [startAttempt.isError, startAttempt.error, attemptId]);

  // Announce milestones
  useEffect(() => {
    const sec = timer.secondsLeft;
    for (const threshold of ANNOUNCE_SECONDS) {
      if (
        sec <= threshold &&
        sec > threshold - 1 &&
        !announcedRef.current.has(threshold)
      ) {
        announcedRef.current.add(threshold);
        break;
      }
    }
  }, [timer.secondsLeft]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (attemptId && !hasSubmitted) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [attemptId, hasSubmitted]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!currentQuestion || !attemptId) return;
      if (answersLocked || timer.isExpired) return;
      setSelectedMap((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
      setSaveStatus("saving");
      saveAnswer.mutate(
        {
          attemptId,
          questionId: currentQuestion.id,
          selectedOptionId: optionId,
        },
        {
          onSuccess: (body) => {
            setSaveStatus("saved");
            setBudgetAnchor({
              remainingSeconds: body.remaining_seconds,
              serverTime: body.server_time,
            });
          },
          onError: () => setSaveStatus("failed"),
        },
      );
    },
    [currentQuestion, attemptId, answersLocked, timer.isExpired, saveAnswer],
  );

  const handleSubmit = useCallback(() => {
    if (!attemptId || hasSubmitted) return;
    setHasSubmitted(true);
    submitAttempt.mutate(attemptId, {
      onSuccess: () => {
        navigate(`/quizzes/${quizId}/result?attemptId=${attemptId}`);
      },
      onError: () => setHasSubmitted(false),
    });
  }, [attemptId, hasSubmitted, quizId, navigate, submitAttempt]);

  // Loading skeleton
  if (startAttempt.isPending || (attemptId && attemptLoading) || takeLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-6 w-48" />
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-2.5 w-2.5 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-56 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    );
  }

  if (startAttempt.isError && !attemptId) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8"
        role="alert"
      >
        <p className="text-destructive">{tCommon("errors.unknown")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  // Question rendering
  const questionForCard = currentQuestion;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {/* Top bar: title + timer */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{t("take.header")}</h1>
        <QuizTimer
          secondsLeft={timer.secondsLeft}
          isWarning={timer.isWarning}
          isExpired={timer.isExpired}
        />
      </div>

      {/* Timer announcement for screen readers */}
      <div aria-live="polite" className="sr-only">
        {timer.isWarning && timer.secondsLeft > 0 && (
          <span>
            {timer.secondsLeft <= 10
              ? `${timer.secondsLeft} seconds remaining`
              : timer.secondsLeft <= 30
                ? t("take.warning")
                : ""}
          </span>
        )}
      </div>

      {/* Progress dots */}
      {questions.length > 0 && (
        <QuizProgressDots
          questions={questions}
          currentIndex={currentIndex}
          onNavigate={setCurrentIndex}
        />
      )}

      {/* Question */}
      {questionForCard && (
        <QuestionCard
          question={questionForCard}
          selectedOptionId={selectedMap[questionForCard.id]}
          onSelect={handleSelect}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          disabled={answersLocked || timer.isExpired}
        />
      )}

      {/* Save status + question counter */}
      <div className="flex items-center justify-between">
        <AutosaveIndicator status={saveStatus} />
        <span className="text-sm text-muted-foreground">
          {t("take.question")} {currentIndex + 1}{" "}
          {t("take.of", { total: questions.length })}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          {t("take.previous")}
        </Button>

        {isLastQuestion ? (
          <Button
            onClick={handleSubmit}
            disabled={hasSubmitted || submitAttempt.isPending}
          >
            {submitAttempt.isPending ? t("take.submitting") : t("take.finish")}
          </Button>
        ) : (
          <Button
            onClick={() =>
              setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
            }
          >
            {t("take.next")}
          </Button>
        )}
      </div>

      {/* Times up overlay */}
      {timer.isExpired && !hasSubmitted && (
        <TimesUpPanel
          onSubmit={handleSubmit}
          isSubmitting={submitAttempt.isPending}
        />
      )}
    </div>
  );
}
