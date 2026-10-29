/**
 * The points of the member and his notifications.
 *
 * Two screens of the personal area of the member: the points he earned
 * and the messages the platform sent him.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { POINTS_BY_QUIZ, POINT_ACTIVITY_PAGE } from "@/test/fixtures/member";
import PointsPage from "@/modules/points/pages/PointsPage";
import { NotificationsPage } from "@/modules/notifications/pages/NotificationsPage";

// The answers of the backend (`PointsResponse` and
// `MonthlyPointsResponse`): the names of the fields are the ones the
// server sends.
const POINTS = {
  lifetime: 120,
  this_week: 15,
  this_month: 40,
  quizzes_completed: 3,
};

const MONTHLY = {
  items: [
    {
      period_month: "2026-10-01",
      points: 40,
      quizzes_completed: 3,
    },
  ],
};

const NOTIFICATION = {
  id: "n1",
  type: "ANNOUNCEMENT" as const,
  title_ar: "اختبار جديد",
  title_en: "A new quiz",
  message_ar: "الاختبار متاح الآن",
  message_en: "The quiz is available now",
  data: null,
  is_read: false,
  is_broadcast: false,
  created_at: "2026-10-22T10:00:00Z",
};

describe("the points of the member", () => {
  it("shows the points of the member", async () => {
    renderPage(<PointsPage />, {
      answers: {
        "/users/me/points/monthly": MONTHLY,
        "/users/me/points": POINTS,
      },
    });

    await waitFor(() => expect(screen.getByText("120")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});

describe("the summary of the points per quiz", () => {
  const baseAnswers = {
    "/users/me/points/monthly": MONTHLY,
    "/users/me/points": POINTS,
    "/users/me/points/history": POINT_ACTIVITY_PAGE,
  };

  it("shows the points of the member in each quiz", async () => {
    renderPage(<PointsPage />, {
      answers: { ...baseAnswers, "/users/me/points/by-quiz": POINTS_BY_QUIZ },
    });

    await waitFor(
      () => expect(screen.getByText("اختبار الآية")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(screen.getByText("اختبار الإيمان")).toBeInTheDocument();
    // The numbers are formatted with the Arabic digits of ar-EG.
    expect(screen.getByText("٦٠")).toBeInTheDocument();
    expect(screen.getByText("٣")).toBeInTheDocument();
    expect(screen.getByText("٨٫٥ / 10")).toBeInTheDocument();
    expect(screen.getByText(/٦٢/)).toBeInTheDocument();
  });

  it("says that there is no quiz yet", async () => {
    renderPage(<PointsPage />, {
      answers: {
        ...baseAnswers,
        "/users/me/points/by-quiz": { ...POINTS_BY_QUIZ, items: [], total: 0 },
      },
    });

    await waitFor(
      () =>
        expect(screen.getByText("لم تخض أي اختبار بعد")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("shows the error when the summary fails", async () => {
    renderPage(<PointsPage />, {
      answers: {
        ...baseAnswers,
        "/users/me/points/by-quiz": {
          status: 500,
          body: { detail: "server error" },
        },
      },
    });

    await waitFor(
      () => expect(screen.getByText("حاول مرة تاني")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });
});

describe("the notifications of the member", () => {
  it("shows the notifications", async () => {
    renderPage(<NotificationsPage />, {
      answers: {
        "/notifications/summary": {
          unread_count: 1,
          tab_counts: {
            all: 1,
            unread: 1,
            announcements: 1,
            reminders: 0,
            system: 0,
          },
        },
        "/notifications": {
          items: [NOTIFICATION],
          total: 1,
          page: 1,
          size: 20,
          pages: 1,
          has_next: false,
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("اختبار جديد").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that there is no notification", async () => {
    renderPage(<NotificationsPage />, {
      answers: {
        "/notifications/summary": { unread_count: 0, total_count: 0 },
        "/notifications": {
          items: [],
          total: 0,
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
