import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../api";
import { pointsKeys } from "../api/queryKeys";

export function useMyPoints() {
  return useQuery({
    queryKey: pointsKeys.totals(),
    queryFn: () => pointsApi.getMyPoints(),
  });
}
