import { useMutation } from "@tanstack/react-query";
import { quizApi } from "../api";

interface SaveAnswerVars {
  attemptId: string;
  questionId: string;
  selectedOptionId: string;
}

export function useSaveAnswer() {
  return useMutation({
    mutationFn: ({ attemptId, questionId, selectedOptionId }: SaveAnswerVars) =>
      quizApi.saveAnswer(attemptId, questionId, selectedOptionId),
    retry: false,
    throwOnError: false,
  });
}
