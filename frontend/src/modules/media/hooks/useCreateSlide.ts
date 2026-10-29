import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";

export function useCreateSlide() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: FormData) => mediaApi.createSlide(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.adminSlides() });
    },
  });
}
