import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";

export function useReorderSlides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => mediaApi.reorderSlides(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.adminSlides() });
    },
  });
}
