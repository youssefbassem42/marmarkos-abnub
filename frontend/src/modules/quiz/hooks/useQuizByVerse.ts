import { useQuery } from "@tanstack/react-query";
import { quizApi } from "../api";
import { quizKeys } from "../api/queryKeys";

export function useQuizByVerse(verseId: string) {
  return useQuery({
    queryKey: quizKeys.byVerse(verseId),
    queryFn: () => quizApi.getQuizByVerse(verseId),
    enabled: !!verseId,
  });
}
