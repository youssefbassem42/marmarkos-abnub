import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useArchiveVerse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (verseId: string) => bibleApi.archiveVerse(verseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
    },
  });
}
