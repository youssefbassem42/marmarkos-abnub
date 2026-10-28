/**
 * The pages of the administration.
 *
 * The analytics of the month and the list of the members are the two
 * screens the administration looks at every week. They were rendered by
 * nobody.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import MonthlyAnalyticsPage from "@/modules/analytics/pages/MonthlyAnalyticsPage";
import { UsersAdminPage } from "@/modules/users/pages/UsersAdminPage";

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

describe("the analytics of the month", () => {
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
    // The month is sent as "month=YYYY-MM" - the deprecated pair of
    // "year" and "month" is never sent again.
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
        "/users": [
          {
            id: "u1",
            email: "member@example.com",
            full_name: "محمود",
            role: "MEMBER",
            status: "ACTIVE",
            phone: "+201000000000",
            avatar_url: null,
            attendance_pin_set: true,
            public_id: "M-0001",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
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
