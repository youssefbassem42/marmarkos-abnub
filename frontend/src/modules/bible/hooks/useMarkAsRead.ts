import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bibleApi } from "../api";
import { bibleKeys } from "../api/queryKeys";

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (verseId: string) => bibleApi.markAsRead(verseId),
    onMutate: async (verseId) => {
      await queryClient.cancelQueries({ queryKey: bibleKeys.detail(verseId) });
      const previous = queryClient.getQueryData(bibleKeys.detail(verseId));
      queryClient.setQueryData(bibleKeys.detail(verseId), (old: Awaited<ReturnType<typeof bibleApi.getVerse>> | undefined) =>
        old ? { ...old, read: true } : old,
      );
      return { previous };
    },
    onError: (_err, verseId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(bibleKeys.detail(verseId), context.previous);
      }
    },
    onSettled: (_data, _err, verseId) => {
      void queryClient.invalidateQueries({ queryKey: bibleKeys.detail(verseId) });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.published() });
      void queryClient.invalidateQueries({ queryKey: bibleKeys.current() });
    },
  });
}
