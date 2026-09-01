import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useSubmitAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attemptId: string) => quizApi.submitAttempt(attemptId),
    onSuccess: (_data, attemptId) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.attempt(attemptId) });
    },
  });
}
