import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { ReorderQuestionsPayload } from "../types";

export function useReorderQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: ReorderQuestionsPayload }) =>
      quizApi.reorderQuestions(quizId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
      void queryClient.invalidateQueries({ queryKey: quizKeys.detail(variables.quizId) });
    },
  });
}
