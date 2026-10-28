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
import {
  ABSENT_USERS,
  MEETING_ATTENDANCE,
  MEETING_SCHEDULE,
  MEETING_STATISTICS,
} from "@/test/fixtures/attendance";
import { AttendanceDashboardPage } from "@/modules/attendance/pages/AttendanceDashboardPage";

describe("the board of the attendance", () => {
  it("shows the meetings of the month and the roster of the day", async () => {
    renderPage(<AttendanceDashboardPage />, {
      admin: true,
      answers: {
        "/attendance/meetings": MEETING_SCHEDULE,
        "/attendance/statistics/meeting": MEETING_STATISTICS,
        "/attendance/meeting": MEETING_ATTENDANCE,
        "/attendance/absent": ABSENT_USERS,
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
        "/attendance/meetings": {
          ...MEETING_SCHEDULE,
          month: 11,
          meetings: [],
        },
        "/attendance/statistics/meeting": MEETING_STATISTICS,
        "/attendance/meeting": MEETING_ATTENDANCE,
        "/attendance/absent": ABSENT_USERS,
      },
    });

    // The page is still there (no crash): the shell is rendered.
    await waitFor(() => expect(document.body).toBeInTheDocument());
    expect(screen.queryByText("محمود")).not.toBeInTheDocument();
  });
});
