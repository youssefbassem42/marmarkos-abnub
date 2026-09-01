import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useQuiz(quizId: string) {
  return useQuery({
    queryKey: quizKeys.detail(quizId),
    queryFn: () => quizApi.getQuiz(quizId),
  });
}
