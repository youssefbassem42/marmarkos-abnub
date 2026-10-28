/**
 * The client-side memory of an attempt in progress (the resume of a quiz).
 *
 * The server owns the truth: every answer is saved through
 * `PUT /quiz-attempts/{id}/answers/{question_id}` and the grading reads
 * it from there. This module is the *client* half of the resume:
 *
 * - it remembers the attempt, so a reload (or a remount of the route)
 *   does not have to start a second attempt - the server would answer
 *   `409 attempt_exists` and the page would have to guess its way back;
 * - it remembers the answers that were chosen but not yet confirmed by
 *   the server, so the radio buttons are checked again immediately;
 * - it remembers the question the member was on, so the page opens on
 *   the last question he solved instead of the first one.
 *
 * The attempt is kept in two places, because they fail differently:
 *
 * - `localStorage` survives a refresh of the page (and a closed tab);
 * - the module map survives a **remount** of the page inside the same
 *   tab. React drops the state of an unmounted component, and the
 *   callbacks of a mutation are not called when the component is gone
 *   (React Query): the id of the attempt would be lost between the
 *   answer and the next render. The map is written from inside the
 *   request itself, so it is written even when nobody is listening.
 *
 * The draft is removed as soon as the attempt is submitted: the result
 * belongs to the server from then on.
 *
 * Why `localStorage` and not `sessionStorage`: the whole point is to
 * survive a refresh of the page. It holds no credential - the access
 * token lives in the memory (SEC-004) and the refresh cookie is HttpOnly.
 */

const KEY_PREFIX = "marmarkos.quiz.draft.";

/** The attempt of every quiz of this tab (survives a remount). */
const knownAttempts = new Map<string, string>();

export interface QuizAttemptDraft {
  /** The attempt of the member (the id the server gave). */
  attemptId: string;
  /** The quiz of the draft. */
  quizId: string;
  /** The chosen option per question. */
  answers: Record<string, string>;
  /** The index of the question the member was on. */
  currentIndex: number;
  /** When the draft was written (epoch milliseconds). */
  savedAt: number;
}

function storageKey(quizId: string): string {
  return `${KEY_PREFIX}${quizId}`;
}

/**
 * Remember the attempt of a quiz.
 *
 * Called from inside the request that created it: the page may be gone
 * by then, but the next page that opens the quiz finds the attempt.
 */
export function rememberAttempt(quizId: string, attemptId: string): void {
  if (!quizId || !attemptId) return;
  knownAttempts.set(quizId, attemptId);
}

/** The attempt of a quiz that this tab already knows, or null. */
export function knownAttempt(quizId: string): string | null {
  return knownAttempts.get(quizId) ?? null;
}

/**
 * The question the page opens on: the first one without an answer.
 *
 * The member answers, then moves on: the page must open where he left
 * off, not at the first question. When every question is answered, he
 * lands on the last question he solved.
 */
export function resumeIndex(
  questionIds: string[],
  answers: Record<string, string>,
): number {
  if (questionIds.length === 0) return 0;
  const firstUnanswered = questionIds.findIndex((id) => !answers[id]);
  if (firstUnanswered >= 0) return firstUnanswered;
  // Every question is answered: the last one is where he was.
  return questionIds.length - 1;
}

/** The draft of a quiz, or null when there is none (or it is broken). */
export function readQuizDraft(quizId: string): QuizAttemptDraft | null {
  if (!quizId) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuizAttemptDraft>;
    if (
      typeof parsed?.attemptId !== "string" ||
      parsed.attemptId.length === 0 ||
      typeof parsed.quizId !== "string" ||
      parsed.quizId !== quizId
    ) {
      return null;
    }
    return {
      attemptId: parsed.attemptId,
      quizId: parsed.quizId,
      answers:
        parsed.answers && typeof parsed.answers === "object"
          ? parsed.answers
          : {},
      currentIndex:
        typeof parsed.currentIndex === "number" && parsed.currentIndex >= 0
          ? parsed.currentIndex
          : 0,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    // A broken or unreadable storage must never stop the quiz.
    return null;
  }
}

/** Write the draft. A full or disabled storage is not an error. */
export function writeQuizDraft(draft: QuizAttemptDraft): void {
  try {
    window.localStorage.setItem(
      storageKey(draft.quizId),
      JSON.stringify(draft),
    );
  } catch {
    // The quota is full or the storage is disabled: the quiz continues,
    // the server still owns the answers.
  }
  rememberAttempt(draft.quizId, draft.attemptId);
}

/** Remove the draft of a quiz (the attempt is over). */
export function clearQuizDraft(quizId: string): void {
  if (!quizId) return;
  try {
    window.localStorage.removeItem(storageKey(quizId));
  } catch {
    // Nothing to do: a draft that cannot be removed is harmless.
  }
  knownAttempts.delete(quizId);
}
