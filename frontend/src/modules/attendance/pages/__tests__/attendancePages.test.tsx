/**
 * The pages of the attendance.
 *
 * The check-in is the screen the servant looks at all evening: it
 * records the presence of a member with the QR code or with the PIN.
 * The dashboard is the screen the administration looks at in the
 * morning.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import {
  CHECK_IN_RESPONSE,
  MEETING_ATTENDANCE,
  MEETING_STATISTICS,
} from "@/test/fixtures/attendance";
import { CheckInPage } from "@/modules/attendance/pages/CheckInPage";
import { AttendanceDashboardPage } from "@/modules/attendance/pages/AttendanceDashboardPage";

/** The answers every page of the attendance needs. */
const MEETING_ANSWERS = {
  "/attendance/statistics/meeting": {
    ...MEETING_STATISTICS,
    summary: {
      ...MEETING_STATISTICS.summary,
      total_present: 8,
      total_late: 1,
      total_attended: 9,
      total_absent: 3,
      excused_count: 0,
      attendance_rate: 75,
    },
  },
  "/attendance/meeting": MEETING_ATTENDANCE,
};

describe("the page of the check-in", () => {
  it("opens on the scanner and offers the PIN", async () => {
    renderPage(<CheckInPage />);

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /مسح QR/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: /رمز PIN/ })).toBeInTheDocument();
  });

  it("shows the PIN entry when the tab is chosen", async () => {
    renderPage(<CheckInPage />, { answers: MEETING_ANSWERS });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /رمز PIN/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /رمز PIN/ }));

    await waitFor(() =>
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0),
    );
  });

  it("records the presence of the member with the PIN", async () => {
    const { calls } = renderPage(<CheckInPage />, {
      answers: {
        ...MEETING_ANSWERS,
        "/attendance/check-in": CHECK_IN_RESPONSE,
      },
    });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /رمز PIN/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /رمز PIN/ }));

    const digits = await screen.findAllByRole("textbox");
    await waitFor(() => expect(digits.length).toBe(5));

    for (const [index, digit] of [..."12345"].entries()) {
      fireEvent.change(digits[index], { target: { value: digit } });
    }

    await waitFor(
      () =>
        expect(
          calls.some(
            (call) =>
              call.method === "post" && call.url === "/attendance/check-in",
          ),
        ).toBe(true),
      { timeout: 5_000 },
    );

    // The member is announced as present.
    await waitFor(
      () =>
        expect(screen.getAllByText("تم تسجيل الحضور").length).toBeGreaterThan(
          0,
        ),
      { timeout: 5_000 },
    );
  });

  it("says that the member is already registered", async () => {
    renderPage(<CheckInPage />, {
      answers: {
        ...MEETING_ANSWERS,
        "/attendance/check-in": { status: 409, body: { code: "conflict" } },
      },
    });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /رمز PIN/ })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /رمز PIN/ }));

    const digits = await screen.findAllByRole("textbox");
    for (const [index, digit] of [..."12345"].entries()) {
      fireEvent.change(digits[index], { target: { value: digit } });
    }

    await waitFor(
      () =>
        expect(
          screen.getAllByText("تم تسجيل الحضور لهذا الاجتماع بالفعل").length,
        ).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});

describe("the dashboard of the attendance", () => {
  it("shows the tiles of the meeting", async () => {
    renderPage(<AttendanceDashboardPage />, {
      admin: true,
      answers: {
        "/attendance/meeting": {
          meeting_date: "2026-10-22",
          meeting_index_in_month: 4,
          is_open: true,
          total_present: 8,
          attendance_records: [],
        },
        "/attendance/statistics/meeting": {
          meeting_date: "2026-10-22",
          meeting_index_in_month: 4,
          summary: {
            total_present: 8,
            total_late: 1,
            total_attended: 9,
            total_absent: 3,
            total_excused: 0,
            attendance_rate: 75,
          },
        },
        "/attendance/statistics/monthly": {
          year: 2026,
          month: 10,
          total_meetings: 4,
          meetings_held: 3,
          expected_per_meeting: 12,
          meetings: [],
          total_attendance: 27,
          average_attendance: 9,
          attendance_rate: 75,
          distinct_attendees: 11,
          full_attendance_count: 2,
          no_attendance_count: 1,
        },
        "/attendance/absent": {
          meeting_date: "2026-10-22",
          absent_count: 3,
          absent_users: [],
          is_final: true,
        },
        "/bible-verses/analytics/overview": {
          total_posts: 12,
          published: 10,
          total_opens: 300,
          total_reads: 240,
          read_rate: 80,
        },
        "/quizzes/analytics/overview": {
          total_quizzes: 8,
          published_quizzes: 6,
          participants: 40,
          completed: 30,
          auto_finished: 2,
          average_score: 7.5,
        },
        "/attendance/meetings": {
          year: 2026,
          month: 10,
          meeting_day: "الخميس",
          total_meetings: 4,
          meetings: ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"],
          open_meeting_date: "2026-10-22",
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText(/الحاضر|حاضر/).length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});
