import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useAdminQuizzes(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: quizKeys.quizList(params),
    queryFn: () => quizApi.getQuizzes(params),
    placeholderData: keepPreviousData,
  });
}
