import { useMutation } from "@tanstack/react-query";
import { quizApi } from "../api";

export function useStartAttempt() {
  return useMutation({
    mutationFn: (quizId: string) => quizApi.startAttempt(quizId),
  });
}
