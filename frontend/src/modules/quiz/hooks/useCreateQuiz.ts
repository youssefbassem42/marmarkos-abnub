import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";
import type { CreateQuizPayload } from "../types";

export function useCreateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuizPayload) => quizApi.createQuiz(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.quizzes() });
    },
  });
}
