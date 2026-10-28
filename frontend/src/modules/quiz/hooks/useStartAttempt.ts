import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { quizApi } from "../api";

/**
 * The attempt of a member is unique (D-4): one attempt per member and
 * quiz, for ever.
 *
 * The server answers a second start with `409 attempt_exists` and carries
 * the id of the existing attempt (`data.attempt_id` - "resumes it"). The
 * page must therefore **resume** that attempt instead of showing an
 * error: React remounts a route (a lazy chunk, StrictMode, a change of
 * the guard), and the answer of the first start is lost with the
 * unmounted component - the second start is then the normal case, not an
 * error.
 *
 * Without this, the member stares at the loading skeleton forever.
 */
export function attemptIdFromError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 409) return null;
  const attemptId = error.data?.attempt_id;
  return typeof attemptId === "string" && attemptId.length > 0
    ? attemptId
    : null;
}

export function useStartAttempt() {
  return useMutation({
    mutationFn: (quizId: string) => quizApi.startAttempt(quizId),
  });
}
