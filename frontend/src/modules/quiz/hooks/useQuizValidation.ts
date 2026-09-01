import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useQuizValidation(quizId: string) {
  return useQuery({
    queryKey: quizKeys.validate(quizId),
    queryFn: () => quizApi.validateQuiz(quizId),
    enabled: !!quizId,
  });
}
