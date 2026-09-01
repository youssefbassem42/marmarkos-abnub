import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useAttempt(
  attemptId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.attempt(attemptId),
    queryFn: () => quizApi.getAttemptStatus(attemptId),
    staleTime: 0,
    retry: false,
    enabled: options?.enabled ?? true,
  });
}
