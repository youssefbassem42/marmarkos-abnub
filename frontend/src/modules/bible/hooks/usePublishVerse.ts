import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function usePublishVerse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (verseId: string) => bibleApi.publishVerse(verseId),
    onSuccess: (_data, verseId) => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.detail(verseId) });
    },
  });
}
