import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useAttemptResult(
  attemptId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: quizKeys.attemptResult(attemptId),
    queryFn: () => quizApi.getResult(attemptId),
    enabled: options?.enabled ?? true,
  });
}
