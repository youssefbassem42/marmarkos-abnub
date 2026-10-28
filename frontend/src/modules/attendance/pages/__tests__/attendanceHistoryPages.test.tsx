/**
 * The pages of the history of the attendance and of the absent members.
 *
 * The history is what the administration reads when a member asks
 * "was I there?"; the absent list is what it reads on Thursday evening.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { AttendanceHistoryPage } from "@/modules/attendance/pages/AttendanceHistoryPage";
import { AbsentUsersPage } from "@/modules/attendance/pages/AbsentUsersPage";

const RECORD = {
  id: "record-1",
  user_id: "u1",
  user_name: "محمود",
  meeting_date: "2026-10-22",
  meeting_index_in_month: 4,
  check_in_at: "2026-10-22T19:03:00Z",
  status: "PRESENT" as const,
  method: "PIN" as const,
  recorded_by: "u2",
  recorded_by_name: "الخادم",
};

describe("the history of the attendance", () => {
  it("shows the records of the meetings", async () => {
    renderPage(<AttendanceHistoryPage />, {
      admin: true,
      answers: {
        "/attendance": {
          total_count: 1,
          attendance_records: [RECORD],
          page: 1,
          size: 20,
          pages: 1,
          has_next: false,
        },
      },
    });

    await waitFor(
      () => expect(screen.getAllByText("محمود").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that the history is empty", async () => {
    renderPage(<AttendanceHistoryPage />, {
      admin: true,
      answers: {
        "/attendance": {
          total_count: 0,
          attendance_records: [],
          page: 1,
          size: 20,
          pages: 1,
          has_next: false,
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText(/لا توجد|لا يوجد|/).length).toBeGreaterThan(
          0,
        ),
      { timeout: 5_000 },
    );
  });
});

describe("the list of the absent members", () => {
  it("shows the members who are absent", async () => {
    renderPage(<AbsentUsersPage />, {
      admin: true,
      answers: {
        "/attendance/absent": {
          meeting_date: "2026-10-22",
          absent_count: 1,
          absent_users: [
            {
              user_id: "u3",
              name: "مينا",
              email: "mina@example.com",
              role: "MEMBER",
            },
          ],
          is_final: true,
          page: 1,
          size: 20,
        },
      },
    });

    await waitFor(
      () => expect(screen.getAllByText("مينا").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that nobody is absent", async () => {
    renderPage(<AbsentUsersPage />, {
      admin: true,
      answers: {
        "/attendance/absent": {
          meeting_date: "2026-10-22",
          absent_count: 0,
          absent_users: [],
          is_final: true,
          page: 1,
          size: 20,
        },
      },
    });

    await waitFor(
      () => expect(screen.getAllByText(/لا يوجد|لا/).length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});
