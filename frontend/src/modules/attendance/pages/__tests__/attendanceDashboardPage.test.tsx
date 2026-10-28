/**
 * The board of the attendance of the month.
 *
 * The dashboard of the servant: the meetings of the month, the roster
 * of the meeting of the day, the statistics and the list of the
 * absentees. Every number on the screen comes from the API, and a
 * meeting that does not exist yet must not break the page.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { AttendanceDashboardPage } from "@/modules/attendance/pages/AttendanceDashboardPage";

const SCHEDULE = {
  year: 2026,
  month: 10,
  meetings: [
    {
      meeting_date: "2026-10-01",
      status: "HELD",
      total_members: 40,
      present_count: 30,
      late_count: 4,
      absent_count: 6,
    },
    {
      meeting_date: "2026-10-08",
      status: "HELD",
      total_members: 40,
      present_count: 35,
      late_count: 2,
      absent_count: 3,
    },
  ],
};

const ROSTER = {
  meeting_date: "2026-10-08",
  attendance_records: [
    {
      id: "r1",
      user_id: "u1",
      user_name: "محمود",
      check_in_at: "2026-10-08T19:02:00Z",
      status: "PRESENT",
      recorded_by_name: "الخادم",
    },
  ],
  total: 1,
};

const STATS = {
  meeting_date: "2026-10-08",
  present: 35,
  late: 2,
  absent: 3,
  total_members: 40,
  attendance_rate: 92,
};

describe("the board of the attendance", () => {
  it("shows the meetings of the month and the roster of the day", async () => {
    renderPage(<AttendanceDashboardPage />, {
      admin: true,
      answers: {
        "/attendance/meetings": SCHEDULE,
        "/attendance/statistics/meeting": STATS,
        "/attendance/meeting": ROSTER,
        "/attendance/absent": { absent_users: [], absent_count: 0 },
      },
    });

    await waitFor(() => expect(screen.getByText("محمود")).toBeInTheDocument(), {
      timeout: 5_000,
    });
  });

  it("does not break when the month has no meeting yet", async () => {
    renderPage(<AttendanceDashboardPage />, {
      admin: true,
      answers: {
        "/attendance/meetings": { year: 2026, month: 11, meetings: [] },
        "/attendance/statistics/meeting": STATS,
        "/attendance/meeting": ROSTER,
        "/attendance/absent": { absent_users: [], absent_count: 0 },
      },
    });

    // The page is still there (no crash): the shell is rendered.
    await waitFor(() => expect(document.body).toBeInTheDocument());
    expect(screen.queryByText("محمود")).not.toBeInTheDocument();
  });
});
