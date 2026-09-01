import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { CreateQuestionPayload } from "../types";

export function useSaveQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: CreateQuestionPayload }) =>
      quizApi.createQuestion(quizId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.detail(variables.quizId) });
      void queryClient.invalidateQueries({ queryKey: quizKeys.questions(variables.quizId) });
    },
  });
}
