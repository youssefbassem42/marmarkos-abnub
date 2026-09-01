import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function usePublishQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (quizId: string) => quizApi.publishQuiz(quizId),
    onSuccess: (_data, quizId) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
      void queryClient.invalidateQueries({ queryKey: quizKeys.detail(quizId) });
    },
  });
}
