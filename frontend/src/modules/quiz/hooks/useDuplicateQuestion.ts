import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useDuplicateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, questionId }: { quizId: string; questionId: string }) =>
      quizApi.duplicateQuestion(quizId, questionId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
      void queryClient.invalidateQueries({ queryKey: quizKeys.detail(variables.quizId) });
    },
  });
}
