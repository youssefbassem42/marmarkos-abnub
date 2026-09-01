import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";
import type { SchedulePayload } from "../types";

export function useRescheduleVerse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ verseId, data }: { verseId: string; data: SchedulePayload }) =>
      bibleApi.rescheduleVerse(verseId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.schedule(variables.verseId) });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.verses() });
    },
  });
}
