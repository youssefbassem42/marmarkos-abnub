import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { attendanceApi } from "../api";
import { attendanceKeys } from "../api/queryKeys";
import type { AttendanceHistoryFilters } from "../types";

/** One page of filtered, SQL-sorted attendance history. */
export function useAttendanceHistory(filters: AttendanceHistoryFilters) {
  const {
    page = 1,
    size = 20,
    sort = "meeting_date",
    order = "desc",
    ...rest
  } = filters;

  return useQuery({
    queryKey: attendanceKeys.history({ page, size, sort, order, ...rest }),
    queryFn: () =>
      attendanceApi.getAttendanceHistory({
        ...rest,
        status: rest.status || undefined,
        page,
        size,
        sort,
        order,
      }),
    placeholderData: keepPreviousData,
  });
}
