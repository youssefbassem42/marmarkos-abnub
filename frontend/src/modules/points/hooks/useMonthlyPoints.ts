import { useQuery } from "@tanstack/react-query";
import { pointsApi } from "../api";
import { pointsKeys } from "../api/queryKeys";

export function useMonthlyPoints() {
  return useQuery({
    queryKey: pointsKeys.monthly(),
    queryFn: () => pointsApi.getMonthlyPoints(),
  });
}
