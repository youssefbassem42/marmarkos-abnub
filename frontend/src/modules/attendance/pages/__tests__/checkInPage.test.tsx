/**
 * The page of the check-in of a member.
 *
 * Two ways to check in: the QR code of the member, or the PIN he
 * chose himself when the camera does not work. The page opens on the
 * scanner; the PIN is behind a tab. A check-in that the server refuses
 * must say so, and must not look like a success.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { CheckInPage } from "@/modules/attendance/pages/CheckInPage";

const STATISTICS = {
  meeting_date: "2026-10-22",
  meeting_index_in_month: 3,
  summary: {
    total_present: 30,
    total_late: 4,
    total_attended: 34,
    excused_count: 1,
    total_absent: 5,
    total_expected: 40,
    attendance_rate: 85,
    is_final: false,
  },
};

const MEETING = {
  meeting_date: "2026-10-22",
  meeting_index_in_month: 3,
  is_open: true,
  total_present: 30,
  attendance_records: [],
};

const CHECKED_IN = {
  success: true,
  message: "تم تسجيل الحضور",
  attendance: {
    id: "a1",
    user_id: "u1",
    meeting_date: "2026-10-22",
    check_in_at: "2026-10-22T19:03:00Z",
    status: "PRESENT",
    recorded_by_name: null,
  },
};

describe("the page of the check-in", () => {
  it("opens on the scanner, and the PIN is behind a tab", async () => {
    renderPage(<CheckInPage />, {
      answers: {
        "/attendance/statistics/meeting": STATISTICS,
        "/attendance/meeting": MEETING,
      },
    });

    // The tab of the PIN exists, but the boxes do not yet.
    const pinTab = await screen.findByRole("tab", { name: /رمز PIN/i });
    expect(pinTab).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("records the attendance when the five digits of the PIN are typed", async () => {
    const harness = renderPage(<CheckInPage />, {
      answers: {
        "/attendance/statistics/meeting": STATISTICS,
        "/attendance/meeting": MEETING,
        "POST /attendance/check-in": CHECKED_IN,
      },
    });

    fireEvent.click(await screen.findByRole("tab", { name: /رمز PIN/i }));

    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(5));

    const boxes = screen.getAllByRole("textbox");
    "12345".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });

    await waitFor(() =>
      expect(
        harness.calls.filter((call) =>
          call.url.includes("/attendance/check-in"),
        ),
      ).toHaveLength(1),
    );
  });

  it("says so when the server refuses the check-in", async () => {
    renderPage(<CheckInPage />, {
      answers: {
        "/attendance/statistics/meeting": STATISTICS,
        "/attendance/meeting": MEETING,
        "POST /attendance/check-in": {
          status: 422,
          body: {
            detail: {
              code: "validation_error",
              message: "No member is registered with this PIN",
            },
          },
        },
      },
    });

    fireEvent.click(await screen.findByRole("tab", { name: /رمز PIN/i }));

    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(5));

    const boxes = screen.getAllByRole("textbox");
    "12345".split("").forEach((digit, index) => {
      fireEvent.change(boxes[index], { target: { value: digit } });
    });

    await waitFor(
      () =>
        expect(
          screen.getAllByText(/الرمز غير صحيح — لا يوجد عضو بهذا الرمز/),
        ).toHaveLength(2),
      { timeout: 5_000 },
    );
  });
});
