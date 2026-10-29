import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { mediaApi } from "../api";
import { mediaKeys } from "../api/queryKeys";
import type { MediaSlideListParams } from "../types";

export function useAdminSlides(params?: MediaSlideListParams) {
  return useQuery({
    queryKey: mediaKeys.adminSlides(params),
    queryFn: () => mediaApi.getAdminSlides(params),
    placeholderData: keepPreviousData,
  });
}
