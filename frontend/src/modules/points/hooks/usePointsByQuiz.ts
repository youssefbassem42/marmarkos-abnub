import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { pointsApi } from "../api";
import { pointsKeys } from "../api/queryKeys";
import type { PointsByQuizParams } from "../types";

export function usePointsByQuiz(params?: PointsByQuizParams) {
  return useQuery({
    queryKey: pointsKeys.byQuiz(params),
    queryFn: () => pointsApi.getMyPointsByQuiz(params),
    placeholderData: keepPreviousData,
  });
}
