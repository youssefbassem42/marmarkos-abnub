/**
 * The hooks of the attendance.
 *
 * They are the layer the check-in screen and the dashboards lean on:
 * what matters is that each hook asks the right endpoint with the
 * right filters, and that a check-in invalidates the views that have
 * to show the new state.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attendanceKeys } from "@/modules/attendance/api/queryKeys";
import {
  onlyCall,
  recordApiCalls,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

import { useAbsentUsers } from "../useAbsentUsers";
import { useAttendanceHistory } from "../useAttendanceHistory";
import { useCheckIn } from "../useCheckIn";
import { useExcuseAttendance } from "../useExcuseAttendance";
import { useMeetingAttendance } from "../useMeetingAttendance";
import { useMeetingSchedule } from "../useMeetingSchedule";
import { useMeetingStatistics } from "../useMeetingStatistics";
import { useMonthlyStatistics } from "../useMonthlyStatistics";
import { useMyAttendance } from "../useMyAttendance";

let recorder: RecordingAdapter;
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  recorder = recordApiCalls({});
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(() => {
  recorder.restore();
});

describe("the attendance queries", () => {
  it("reads the roster of a meeting", async () => {
    const { result } = renderHook(() => useMeetingAttendance("2026-09-24"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlyCall(recorder.calls).url).toBe("/attendance/meeting");
  });

  it("reads the calendar of a month", async () => {
    const { result } = renderHook(() => useMeetingSchedule(2026, 9), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance/meetings");
    expect(call.params).toEqual({ year: 2026, month: 9 });
  });

  it("reads the statistics of a meeting and of a month", async () => {
    const meeting = renderHook(() => useMeetingStatistics("2026-09-24"), {
      wrapper,
    });
    await waitFor(() => expect(meeting.result.current.isSuccess).toBe(true));

    const monthly = renderHook(() => useMonthlyStatistics(2026, 9), {
      wrapper,
    });
    await waitFor(() => expect(monthly.result.current.isSuccess).toBe(true));

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/attendance/statistics/meeting",
      "/attendance/statistics/monthly",
    ]);
  });

  it("reads the absent members with their pagination", async () => {
    const { result } = renderHook(
      () => useAbsentUsers("2026-09-24", { page: 2, size: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(onlyCall(recorder.calls).params).toEqual({
      meeting_date: "2026-09-24",
      page: 2,
      size: 20,
    });
  });

  it("reads the history with the default sort and page", async () => {
    const { result } = renderHook(
      () => useAttendanceHistory({ status: "PRESENT" } as never),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance");
    expect(call.params).toMatchObject({
      page: 1,
      size: 20,
      sort: "meeting_date",
      order: "desc",
      status: "PRESENT",
    });
  });

  it("reads the attendance of the calling member", async () => {
    const { result } = renderHook(() => useMyAttendance(2026, 9), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance/me");
    expect(call.params).toEqual({ year: 2026, month: 9 });
  });
});

describe("useCheckIn", () => {
  it("records the check-in", async () => {
    const { result } = renderHook(() => useCheckIn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ qr_code: "QR-1" } as never);
    });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/attendance/check-in");
  });

  it("refreshes every attendance view after a check-in", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useCheckIn(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ qr_code: "QR-1" } as never);
    });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: attendanceKeys.all,
      }),
    );
    invalidate.mockRestore();
  });
});

describe("useExcuseAttendance", () => {
  it("excuses a record and refreshes the views", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useExcuseAttendance(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        attendanceId: "a1",
        reason: "illness",
      });
    });

    expect(onlyCall(recorder.calls).url).toBe("/attendance/a1/excuse");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: attendanceKeys.all,
      }),
    );
    invalidate.mockRestore();
  });
});
