import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { pointsApi } from "../api";
import { pointsKeys } from "../api/queryKeys";
import type { PointsHistoryParams } from "../types";

export function usePointsHistory(params?: PointsHistoryParams) {
  return useQuery({
    queryKey: pointsKeys.history(params),
    queryFn: () => pointsApi.getMyHistory(params),
    placeholderData: keepPreviousData,
  });
}
