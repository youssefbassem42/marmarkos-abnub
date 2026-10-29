import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { QuizAnalyticsUsersParams } from "../types";

/** The paginated users results of one quiz. */
export function useQuizAnalyticsUsers(
  quizId: string,
  params: QuizAnalyticsUsersParams = {},
) {
  return useQuery({
    queryKey: [...quizKeys.analytics(quizId), "users", params],
    queryFn: () => quizApi.getQuizAnalyticsUsers(quizId, params),
    enabled: !!quizId,
  });
}
