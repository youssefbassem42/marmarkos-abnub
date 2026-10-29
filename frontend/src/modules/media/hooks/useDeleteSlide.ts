import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";

export function useDeleteSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (slideId: string) => mediaApi.deleteSlide(slideId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.adminSlides() });
    },
  });
}
