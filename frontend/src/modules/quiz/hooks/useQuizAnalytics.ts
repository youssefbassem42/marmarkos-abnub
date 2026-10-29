import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

/** The analysis of one quiz: the KPIs, the score distribution and the completion status. */
export function useQuizAnalytics(quizId: string) {
  return useQuery({
    queryKey: [...quizKeys.analytics(quizId)],
    queryFn: () => quizApi.getQuizAnalytics(quizId),
    enabled: !!quizId,
  });
}
