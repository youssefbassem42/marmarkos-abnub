/**
 * React Query key factories for the quiz module.
 *
 * Keys are hierarchical tuples rooted at ["quiz"] so every hook
 * reads/writes through these factories and invalidation stays precise.
 */

export const quizKeys = {
  all: ["quiz"] as const,
  quizzes: () => [...quizKeys.all, "quizzes"] as const,
  quizList: (params?: Record<string, unknown>) =>
    [...quizKeys.quizzes(), "list", params ?? {}] as const,
  detail: (quizId: string) =>
    [...quizKeys.quizzes(), quizId] as const,
  questions: (quizId: string) =>
    [...quizKeys.quizzes(), quizId, "questions"] as const,
  validate: (quizId: string) =>
    [...quizKeys.quizzes(), quizId, "validate"] as const,
  byVerse: (verseId: string) =>
    [...quizKeys.all, "by-verse", verseId] as const,
  analytics: (quizId: string) =>
    [...quizKeys.quizzes(), quizId, "analytics"] as const,
  take: (quizId: string) =>
    [...quizKeys.all, "take", quizId] as const,
  attempts: () => [...quizKeys.all, "attempts"] as const,
  attempt: (attemptId: string) =>
    [...quizKeys.attempts(), attemptId] as const,
  attemptResult: (attemptId: string) =>
    [...quizKeys.attempts(), attemptId, "result"] as const,
  attemptReview: (attemptId: string) =>
    [...quizKeys.attempts(), attemptId, "review"] as const,
};
