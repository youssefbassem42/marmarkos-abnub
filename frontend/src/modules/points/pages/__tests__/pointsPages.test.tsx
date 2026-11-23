/**
 * The points of the member and his notifications.
 *
 * Two screens of the personal area of the member: the points he earned
 * and the messages the platform sent him.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLocation, useNavigate } from "react-router-dom";

import { renderPage } from "@/test/pageHarness";
import { formatMonthYear } from "@/lib/datetime";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { MonthlyPointsSummary } from "@/modules/points/components/MonthlyPointsSummary";
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

function monthWithOffset(offset: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const CURRENT_MONTH = monthWithOffset(0);
const PREVIOUS_MONTH = monthWithOffset(-1);
const EMPTY_MONTH = monthWithOffset(-2);

const MONTHLY = {
  items: [
    {
      period_month: `${CURRENT_MONTH}-01`,
      points: 40,
      quizzes_completed: 3,
    },
    {
      period_month: `${PREVIOUS_MONTH}-01`,
      points: 95,
      quizzes_completed: 5,
    },
    {
      period_month: `${EMPTY_MONTH}-01`,
      points: 0,
      quizzes_completed: 0,
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
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
  });

  it("shows the month in the address", async () => {
    renderPage(<PointsPage />, {
      route: `/points?month=${PREVIOUS_MONTH}`,
      answers: {
        "/users/me/points/monthly": MONTHLY,
        "/users/me/points": POINTS,
      },
    });

    const summary = await screen.findByRole("region", { name: /ملخص/ });
    await waitFor(() =>
      expect(within(summary).getByText("95")).toBeInTheDocument(),
    );
    expect(within(summary).getByText("إجمالي نقاط الشهر")).toBeInTheDocument();
    expect(
      within(summary).getByText("عدد الاختبارات المنجزة"),
    ).toBeInTheDocument();
    expect(within(summary).getByText("5")).toBeInTheDocument();
    expect(within(summary).getByText("19.0")).toBeInTheDocument();
  });

  it("shows the empty state for a month without points", async () => {
    renderPage(<PointsPage />, {
      route: `/points?month=${EMPTY_MONTH}`,
      answers: {
        "/users/me/points/monthly": MONTHLY,
        "/users/me/points": POINTS,
      },
    });

    const summary = await screen.findByRole("region", { name: /ملخص/ });
    expect(
      within(summary).getByText("لا توجد نقاط في هذا الشهر"),
    ).toBeInTheDocument();
  });

  it("shows the current month when the address has no month", async () => {
    renderPage(<PointsPage />, {
      route: "/points",
      answers: {
        "/users/me/points/monthly": MONTHLY,
        "/users/me/points": POINTS,
      },
    });

    const summary = await screen.findByRole("region", { name: /ملخص/ });
    expect(
      within(summary).getByRole("heading", {
        name: new RegExp(
          `ملخص.*${formatMonthYear(`${CURRENT_MONTH}-01`, "ar-EG")}`,
        ),
      }),
    ).toBeInTheDocument();
    expect(within(summary).getByText("40")).toBeInTheDocument();
  });

  it("puts the chosen month in the address and restores it with back", async () => {
    function LocationProbe() {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <>
          <output data-testid="location-search">{location.search}</output>
          <button type="button" onClick={() => navigate(-1)}>
            back
          </button>
        </>
      );
    }

    renderPage(
      <>
        <PointsPage />
        <LocationProbe />
      </>,
      {
        route: "/points",
        answers: {
          "/users/me/points/monthly": MONTHLY,
          "/users/me/points": POINTS,
        },
      },
    );

    const selector = await screen.findByRole("combobox", {
      name: "اختر الشهر",
    });
    fireEvent.click(selector);
    const option = await screen.findByRole("option", {
      name: formatMonthYear(`${PREVIOUS_MONTH}-01`, "ar-EG"),
    });
    expect(
      screen.queryByRole("option", {
        name: formatMonthYear(`${EMPTY_MONTH}-01`, "ar-EG"),
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(option);

    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        `?month=${PREVIOUS_MONTH}`,
      ),
    );
    const summary = screen.getByRole("region", { name: /ملخص/ });
    expect(within(summary).getByText("95")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "back" }));
    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent(""),
    );
    expect(within(summary).getByText("40")).toBeInTheDocument();
  });

  it("shows the skeleton while the monthly points load", () => {
    render(
      <LanguageProvider>
        <MonthlyPointsSummary
          data={undefined}
          selectedMonth={CURRENT_MONTH}
          isPending
          isError={false}
          onRetry={() => undefined}
        />
      </LanguageProvider>,
    );

    expect(
      screen.getByRole("status", { name: "جارٍ تحميل ملخص الشهر..." }),
    ).toBeInTheDocument();
  });

  it("shows the error state when the monthly points fail", async () => {
    renderPage(<PointsPage />, {
      route: "/points",
      answers: {
        "/users/me/points/monthly": { status: 500, body: { detail: "error" } },
        "/users/me/points": POINTS,
      },
    });

    const summary = await screen.findByRole("region", { name: /ملخص/ });
    expect(
      within(summary).getByText("تعذر تحميل ملخص الشهر. حاول مرة تاني."),
    ).toBeInTheDocument();
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
