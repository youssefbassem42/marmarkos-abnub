import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";
import type { UpdateVersePayload } from "../types";

export function useUpdateVerse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ verseId, data }: { verseId: string; data: UpdateVersePayload }) =>
      bibleApi.updateVerse(verseId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.detail(variables.verseId) });
    },
  });
}
