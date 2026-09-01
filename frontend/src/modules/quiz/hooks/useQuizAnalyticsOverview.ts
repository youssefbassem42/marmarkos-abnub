import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useQuizAnalyticsOverview() {
  return useQuery({
    queryKey: [...quizKeys.all, "analytics", "overview"],
    queryFn: quizApi.getAnalyticsOverview,
  });
}
