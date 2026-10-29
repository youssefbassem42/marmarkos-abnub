import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";
import type { MediaSlideListParams } from "../types";

export function usePublicSlides(params?: MediaSlideListParams) {
  return useQuery({
    queryKey: mediaKeys.publicSlides(params),
    queryFn: () => mediaApi.getPublicSlides(params),
    placeholderData: keepPreviousData,
  });
}
