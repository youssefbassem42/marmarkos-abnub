/**
 * The pages of the administration.
 *
 * The analytics of the month and the list of the members are the two
 * screens the administration looks at every week. They were rendered by
 * nobody.
 */

import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download";
import { renderPage } from "@/test/pageHarness";
import { MEMBER } from "@/test/fixtures/member";
import MonthlyAnalyticsPage from "@/modules/analytics/pages/MonthlyAnalyticsPage";
import { UsersAdminPage } from "@/modules/users/pages/UsersAdminPage";

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}));

const mockedDownloadBlob = vi.mocked(downloadBlob);

const OVERVIEW = {
  month: "2026-10-01",
  participants: 18,
  quizzes_completed: 25,
  total_points: 320,
  average_score_out_of_10: 7.4,
  quizzes_published: 4,
  trend: [
    {
      period_month: "2026-08-01",
      total_points: 210,
      participants: 14,
      average_score_out_of_10: 6.8,
    },
    {
      period_month: "2026-09-01",
      total_points: 260,
      participants: 16,
      average_score_out_of_10: 7.1,
    },
  ],
  completion_distribution: [
    { bucket: "100%", users: 6, percentage: 33 },
    { bucket: "75–99%", users: 8, percentage: 44 },
  ],
  top: [
    { rank: 1, user_id: "u1", full_name: "محمود", avatar: null, points: 90 },
    { rank: 2, user_id: "u2", full_name: "م.mode", avatar: null, points: 70 },
  ],
};

const USERS_PAGE = {
  items: [
    {
      rank: 1,
      user_id: "u1",
      full_name: "محمود عبد الله",
      avatar: null,
      quizzes_completed: 4,
      average_score_out_of_10: 8.5,
      total_points: 90,
      completion_rate: 100,
      sparkline: [10, 20, 30, 30],
    },
  ],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buffer);
}

async function blobText(blob: Blob): Promise<string> {
  return new TextDecoder("utf-8").decode(await blobBytes(blob));
}

describe("the analytics of the month", () => {
  beforeEach(() => {
    mockedDownloadBlob.mockClear();
  });

  it("shows the numbers of the month", async () => {
    renderPage(<MonthlyAnalyticsPage />, {
      admin: true,
      answers: {
        "/quiz-analytics/monthly/users": USERS_PAGE,
        "/quiz-analytics/monthly": OVERVIEW,
      },
    });

    await waitFor(() => expect(screen.getByText("18")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    expect(screen.getByText("320")).toBeInTheDocument();
  });

  it("lists the members of the month", async () => {
    renderPage(<MonthlyAnalyticsPage />, {
      admin: true,
      answers: {
        "/quiz-analytics/monthly/users": USERS_PAGE,
        "/quiz-analytics/monthly": OVERVIEW,
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("محمود عبد الله").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("exports the visible page with a pinned Arabic header", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    try {
      const user = userEvent.setup();
      renderPage(<MonthlyAnalyticsPage />, {
        admin: true,
        answers: {
          "/quiz-analytics/monthly/users": USERS_PAGE,
          "/quiz-analytics/monthly": OVERVIEW,
        },
      });

      await user.click(
        await screen.findByRole("button", { name: "تصدير CSV" }),
      );

      await waitFor(() => expect(mockedDownloadBlob).toHaveBeenCalledOnce());
      const [blob, filename] = mockedDownloadBlob.mock.calls[0]!;
      const bytes = await blobBytes(blob);
      const text = await blobText(blob);

      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      expect(filename).toBe("نقاط-2026-10.csv");
      expect(text.replace(/^\uFEFF/, "").split("\r\n")).toEqual([
        "#,الاسم,الاختبارات,النقاط,المتوسط,نسبة الإكمال",
        "1,محمود عبد الله,4,90,8.5,100%",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks the server for the month with the canonical contract", async () => {
    const { calls } = renderPage(<MonthlyAnalyticsPage />, {
      admin: true,
      answers: {
        "/quiz-analytics/monthly/users": USERS_PAGE,
        "/quiz-analytics/monthly": OVERVIEW,
      },
    });

    await waitFor(
      () =>
        expect(
          calls.some((call) => call.url === "/quiz-analytics/monthly"),
        ).toBe(true),
      { timeout: 5_000 },
    );

    const call = calls.find((entry) => entry.url === "/quiz-analytics/monthly");
    // The month is sent as "month=YYYY-MM" - the only shape the server
    // accepts.
    expect(call?.params).toMatchObject({
      month: expect.stringMatching(/^\d{4}-\d{2}$/),
    });
    expect(call?.params).not.toHaveProperty("year");
  });
});

describe("the list of the members", () => {
  it("shows the members", async () => {
    renderPage(<UsersAdminPage />, {
      admin: true,
      answers: {
        // The answer of the backend (`UserResponse`): the names of the
        // fields are the ones the server sends.
        "/users": [
          {
            ...MEMBER,
            id: "u1",
            email: "member@example.com",
            first_name: "محمود",
            last_name: null,
          },
        ],
      },
    });

    await waitFor(
      () =>
        expect(
          screen.getAllByText("member@example.com").length,
        ).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});
