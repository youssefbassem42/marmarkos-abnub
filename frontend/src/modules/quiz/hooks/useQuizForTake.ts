import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useQuizForTake(
  quizId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.take(quizId),
    queryFn: () => quizApi.getQuizForTake(quizId),
    enabled: options?.enabled ?? true,
  });
}
