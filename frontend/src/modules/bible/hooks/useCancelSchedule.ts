import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useCancelSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (verseId: string) => bibleApi.cancelSchedule(verseId),
    onSuccess: (_data, verseId) => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.schedule(verseId) });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
    },
  });
}
