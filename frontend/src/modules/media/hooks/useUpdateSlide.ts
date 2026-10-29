import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";

export function useUpdateSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slideId, data }: { slideId: string; data: FormData }) =>
      mediaApi.updateSlide(slideId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.adminSlides() });
    },
  });
}
