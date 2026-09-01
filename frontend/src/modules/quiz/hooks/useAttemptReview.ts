import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useAttemptReview(attemptId: string) {
  return useQuery({
    queryKey: quizKeys.attemptReview(attemptId),
    queryFn: () => quizApi.getReview(attemptId),
  });
}
