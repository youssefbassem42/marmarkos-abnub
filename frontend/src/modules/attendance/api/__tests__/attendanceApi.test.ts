/**
 * The attendance client.
 *
 * The check-in and the statistics are the heart of the weekly meeting:
 * a wrong date or a wrong status name would show the wrong numbers to
 * the members.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  onlyCall,
  recordApiCallsFor,
  type RecordingAdapter,
} from "@/test/recordingAdapter";
import {
  ABSENT_USERS,
  ATTENDANCE_HISTORY,
  CHECK_IN_RESPONSE,
  MEETING_ATTENDANCE,
  MEETING_SCHEDULE,
  MEETING_STATISTICS,
  MONTHLY_STATISTICS,
  MY_ATTENDANCE,
} from "@/test/fixtures/attendance";

import { attendanceApi, attendancePinApi } from "../index";

let recorder: RecordingAdapter;

beforeEach(() => {
  // The answers have the shape the backend sends: an endpoint with a
  // schema rejects an incomplete answer.
  recorder = recordApiCallsFor({
    "/attendance/check-in": CHECK_IN_RESPONSE,
    "/attendance/meeting": MEETING_ATTENDANCE,
    "/attendance/meetings": MEETING_SCHEDULE,
    "/attendance/absent": ABSENT_USERS,
    "/attendance/statistics/meeting": MEETING_STATISTICS,
    "/attendance/statistics/monthly": MONTHLY_STATISTICS,
    "/attendance/me": MY_ATTENDANCE,
    "/attendance": ATTENDANCE_HISTORY,
    "/attendance/a1/excuse": CHECK_IN_RESPONSE,
  });
});

afterEach(() => {
  recorder.restore();
});

describe("attendanceApi", () => {
  it("records a check-in", async () => {
    await attendanceApi.checkIn({ qr_code: "QR-1" } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/attendance/check-in");
    expect(call.data).toBe(JSON.stringify({ qr_code: "QR-1" }));
  });

  it("reads the meeting without a date when there is none", async () => {
    await attendanceApi.getMeetingAttendance();

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance/meeting");
    expect(call.params).toEqual({});
  });

  it("reads the meeting of a date", async () => {
    await attendanceApi.getMeetingAttendance("2026-09-24");

    expect(onlyCall(recorder.calls).params).toEqual({
      meeting_date: "2026-09-24",
    });
  });

  it("reads the calendar of a month", async () => {
    await attendanceApi.getMeetingSchedule(2026, 9);

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance/meetings");
    expect(call.params).toEqual({ year: 2026, month: 9 });
  });

  it("reads the absent members with their filters", async () => {
    await attendanceApi.getAbsentUsers("2026-09-24", { page: 2, size: 20 });

    expect(onlyCall(recorder.calls).params).toEqual({
      meeting_date: "2026-09-24",
      page: 2,
      size: 20,
    });
  });

  it("reads the statistics of a meeting and of a month", async () => {
    await attendanceApi.getMeetingStatistics("2026-09-24");
    await attendanceApi.getMonthlyStatistics(2026, 9);

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/attendance/statistics/meeting",
      "/attendance/statistics/monthly",
    ]);
    expect(recorder.calls[0]?.params).toEqual({
      meeting_date: "2026-09-24",
    });
    expect(recorder.calls[1]?.params).toEqual({ year: 2026, month: 9 });
  });

  it("reads the history with its filters", async () => {
    await attendanceApi.getAttendanceHistory({
      start_date: "2026-09-01",
      status: "PRESENT",
      page: 1,
      size: 20,
    });

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance");
    expect(call.params).toMatchObject({ status: "PRESENT", page: 1 });
  });

  it("reads the attendance of the calling member", async () => {
    await attendanceApi.getMyAttendance(2026, 9);

    const call = onlyCall(recorder.calls);
    expect(call.url).toBe("/attendance/me");
    expect(call.params).toEqual({ year: 2026, month: 9 });
  });

  it("excuses a record of the open meeting", async () => {
    await attendanceApi.excuseAttendance("a1", "illness");

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/attendance/a1/excuse");
    expect(call.data).toBe(JSON.stringify({ reason: "illness" }));
  });

  it("excuses a record without a reason", async () => {
    await attendanceApi.excuseAttendance("a1");

    expect(onlyCall(recorder.calls).data).toBe(
      JSON.stringify({ reason: null }),
    );
  });
});

describe("attendancePinApi", () => {
  it("reads, writes and removes the PIN of the member", async () => {
    await attendancePinApi.getStatus();
    await attendancePinApi.set("12345");
    await attendancePinApi.remove();

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "get /users/me/attendance-pin",
      "put /users/me/attendance-pin",
      "delete /users/me/attendance-pin",
    ]);
    expect(recorder.calls[1]?.data).toBe(JSON.stringify({ pin: "12345" }));
  });
});
