import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, toApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStartAttempt, attemptIdFromError } from "../hooks/useStartAttempt";
import { useAttempt } from "../hooks/useAttempt";
import { useQuizForTake } from "../hooks/useQuizForTake";
import { useSaveAnswer } from "../hooks/useSaveAnswer";
import { useSubmitAttempt } from "../hooks/useSubmitAttempt";
import { useHeartbeat } from "../hooks/useHeartbeat";
import { useQuizTimer } from "../hooks/useQuizTimer";
import {
  clearQuizDraft,
  knownAttempt,
  readQuizDraft,
  rememberAttempt,
  resumeIndex,
  writeQuizDraft,
  type QuizAttemptDraft,
} from "../lib/attemptDraft";
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

  // The draft of the attempt in progress (the resume of the quiz). It is
  // read **during the first render**, not in an effect: the page can be
  // mounted again right after (a lazy route that resolves, StrictMode)
  // and an effect would run too late - the start request would go out
  // before the draft was known, and the state of the first instance
  // would be lost with it.
  //
  // The draft holds the attempt, the answers that were chosen and the
  // question the member was on.
  const [draft] = useState<QuizAttemptDraft | null>(() =>
    quizId ? readQuizDraft(quizId) : null,
  );
  const draftRef = useRef<QuizAttemptDraft | null>(draft);

  const [attemptId, setAttemptId] = useState<string | null>(
    draft?.attemptId ?? (quizId ? knownAttempt(quizId) : null),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>(
    draft?.answers ?? {},
  );
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
  const {
    data: attempt,
    isLoading: attemptLoading,
    isError: attemptError,
  } = useAttempt(attemptId ?? "", { enabled: !!attemptId });
  const {
    data: takeData,
    isLoading: takeLoading,
    isError: takeError,
  } = useQuizForTake(quizId ?? "", { enabled: !!quizId });
  const saveAnswer = useSaveAnswer();
  const submitAttempt = useSubmitAttempt();

  const questions = useMemo(() => takeData?.questions ?? [], [takeData]);

  // The timer is the server's truth, but the server needs a moment to
  // answer. Until it does, the duration of the quiz is the best
  // estimate - showing "00:00" (the time is over) while the attempt is
  // still loading alarmed the member and locked the answers.
  const timerRemaining =
    budgetAnchor?.remainingSeconds ??
    attempt?.remaining_seconds ??
    takeData?.duration_seconds ??
    0;
  const timerServerTime =
    budgetAnchor?.serverTime ??
    attempt?.server_time ??
    new Date().toISOString();
  // The answers can be given when the attempt exists (the save needs its
  // id) and when the server does not say that the attempt is over. An
  // attempt that is still on its way does not lock the answers: the
  // member can answer as soon as the id is known.
  const answersLocked =
    attemptId == null ||
    hasSubmitted ||
    (attempt !== undefined && attempt.status !== "IN_PROGRESS");

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

  // The server knows the attempt of the member (D-4): the take payload
  // carries it. The page uses it instead of starting a second attempt -
  // which the server would answer with `409 attempt_exists`, and whose
  // callback never arrives when React has already unmounted the page.
  useEffect(() => {
    const existing = takeData?.attempt_id;
    if (!existing || !quizId) return;
    rememberAttempt(quizId, existing);
    setAttemptId((current) => current ?? existing);
  }, [takeData?.attempt_id, quizId]);

  // Start attempt on mount if we have quizId but no attemptId
  useEffect(() => {
    if (!quizId) return;
    if (attemptId) return;
    if (startAttemptTriggeredRef.current) return;
    // The take payload has not arrived yet: it may carry the attempt of
    // the member, and starting one now would be a second attempt.
    if (takeData === undefined) return;
    // A draft of this quiz already holds the attempt: the page resumes
    // it instead of starting a second one.
    if (draftRef.current) return;
    // The server says there is already an attempt for this member and
    // this quiz: it is the one to continue.
    if (takeData.attempt_id) {
      rememberAttempt(quizId, takeData.attempt_id);
      setAttemptId(takeData.attempt_id);
      return;
    }

    startAttemptTriggeredRef.current = true;
    startAttempt.mutate(quizId, {
      onSuccess: (data) => {
        setAttemptId(data.id);
        const initial: Record<string, string> = {};
        data.questions.forEach((q) => {
          if (q.selected_option_id) initial[q.id] = q.selected_option_id;
        });
        setSelectedMap(initial);
        // The draft is written **here** and not in an effect: React can
        // mount a new instance of this page right after (a lazy route
        // that resolves, StrictMode), and the state of the old instance
        // is lost with it. The draft is the only thing that survives.
        writeQuizDraft({
          attemptId: data.id,
          quizId,
          answers: initial,
          currentIndex: 0,
          savedAt: Date.now(),
        });
      },
      onError: (error) => {
        // D-4: one attempt per member and quiz. The server answers a
        // second start with the id of the existing attempt; the member
        // continues that attempt instead of seeing an error (React
        // remounts the route, and the answer of the first start is lost
        // with the unmounted component).
        const existingAttemptId = attemptIdFromError(error);
        if (existingAttemptId) {
          setAttemptId(existingAttemptId);
          writeQuizDraft({
            attemptId: existingAttemptId,
            quizId,
            answers: {},
            currentIndex: 0,
            savedAt: Date.now(),
          });
          return;
        }
        // Any other failure: the error panel of the page takes over
        // (it reads `startAttempt.isError`).
      },
    });
  }, [quizId, attemptId, startAttempt, takeData]);

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

  // A draft that points at an attempt the server does not know (the
  // database was reset, the member used another browser): the draft is
  // dropped and the quiz starts from the beginning.
  useEffect(() => {
    if (!attemptError || !attemptId) return;
    if (quizId) clearQuizDraft(quizId);
    setAttemptId(null);
    setSelectedMap({});
    setCurrentIndex(0);
    startAttemptTriggeredRef.current = false;
  }, [attemptError, attemptId, quizId]);

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

  // Keep the draft of the attempt in step with the page: the answers
  // that were chosen and the question the member is on. The draft is
  // what a refresh of the page restores.
  useEffect(() => {
    if (!quizId || !attemptId) return;
    writeQuizDraft({
      attemptId,
      quizId,
      answers: selectedMap,
      currentIndex,
      savedAt: Date.now(),
    });
  }, [quizId, attemptId, selectedMap, currentIndex]);

  // Open on the last question the member solved. The questions arrive
  // from the API, so the index can only be computed once they are
  // known; the answers of the server win over the ones of the draft.
  useEffect(() => {
    if (questions.length === 0) return;
    const draft = draftRef.current;
    if (!draft) return;
    const merged = { ...draft.answers };
    for (const question of attempt?.questions ?? []) {
      if (question.selected_option_id) {
        merged[question.id] = question.selected_option_id;
      }
    }
    setCurrentIndex(
      resumeIndex(
        questions.map((question) => question.id),
        merged,
      ),
    );
    // Once the index is computed, the draft has done its job.
    draftRef.current = null;
  }, [questions, attempt?.questions]);

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
        // The attempt is over: the result belongs to the server from now
        // on, the draft has nothing left to resume.
        if (quizId) clearQuizDraft(quizId);
        navigate(`/quizzes/${quizId}/result?attemptId=${attemptId}`);
      },
      onError: () => setHasSubmitted(false),
    });
  }, [attemptId, hasSubmitted, quizId, navigate, submitAttempt]);

  // Loading skeleton
  //
  // The skeleton stands for "there is nothing to show yet". Once the
  // questions are known, the page shows them - the request of the
  // attempt may still be on its way, and the page used to flash the
  // skeleton twice (once for the start, once for the attempt) before
  // the member could answer.
  const hasQuestions = questions.length > 0;
  if (
    takeLoading ||
    (!hasQuestions && (startAttempt.isPending || attemptLoading))
  ) {
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

  if ((startAttempt.isError && !attemptId) || (takeError && !hasQuestions)) {
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
