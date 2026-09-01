import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";
import type { CreateVersePayload } from "../types";

export function useCreateVerse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVersePayload) => bibleApi.createVerse(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
    },
  });
}
