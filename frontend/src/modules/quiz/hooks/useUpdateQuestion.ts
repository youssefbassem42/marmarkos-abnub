import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { UpdateQuestionPayload } from "../types";

export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      questionId,
      data,
    }: {
      quizId: string;
      questionId: string;
      data: UpdateQuestionPayload;
    }) => quizApi.updateQuestion(quizId, questionId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
      void queryClient.invalidateQueries({
        queryKey: quizKeys.detail(variables.quizId),
      });
      void queryClient.invalidateQueries({
        queryKey: quizKeys.questions(variables.quizId),
      });
    },
  });
}