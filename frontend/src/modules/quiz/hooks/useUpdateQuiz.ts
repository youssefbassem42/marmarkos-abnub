import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { UpdateQuizPayload } from "../types";

export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: UpdateQuizPayload }) =>
      quizApi.updateQuiz(quizId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
      void queryClient.invalidateQueries({ queryKey: quizKeys.detail(variables.quizId) });
    },
  });
}
