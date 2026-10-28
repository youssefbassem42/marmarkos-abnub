/**
 * The pages of the administration of the quizzes.
 *
 * The list, the management of one quiz and the analytics: the screens
 * the servants use to prepare the quiz of the week.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import QuizListPage from "@/modules/quiz/pages/admin/QuizListPage";
import QuizAnalyticsPage from "@/modules/quiz/pages/admin/QuizAnalyticsPage";

const QUIZ = {
  id: "quiz-1",
  title: "اختبار الآية",
  verse_reference: "١ يوئيل ٣:١",
  verse_id: "verse-1",
  total_points: 10,
  duration_seconds: 600,
  question_count: 2,
  status: "PUBLISHED" as const,
  published_at: "2026-10-20T00:00:00Z",
  created_at: "2026-10-01T00:00:00Z",
};

const LIST = {
  items: [QUIZ],
  total: 1,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};

describe("the list of the quizzes", () => {
  it("shows the quizzes of the administration", async () => {
    renderPage(<QuizListPage />, {
      admin: true,
      answers: { "/quizzes": LIST },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("اختبار الآية").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });

  it("says that there is no quiz yet", async () => {
    renderPage(<QuizListPage />, {
      admin: true,
      answers: { "/quizzes": { ...LIST, items: [], total: 0 } },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText(/لا توجد|لا يوجد|/).length).toBeGreaterThan(
          0,
        ),
      { timeout: 5_000 },
    );
  });

  it("asks the server for the page of the list", async () => {
    const { calls } = renderPage(<QuizListPage />, {
      admin: true,
      answers: { "/quizzes": LIST },
    });

    await waitFor(
      () => expect(calls.some((call) => call.url === "/quizzes")).toBe(true),
      { timeout: 5_000 },
    );
  });
});

describe("the analytics of the quizzes", () => {
  it("shows the numbers of the quizzes", async () => {
    renderPage(<QuizAnalyticsPage />, {
      admin: true,
      answers: {
        "/quizzes/analytics/overview": {
          total_quizzes: 8,
          published_quizzes: 6,
          participants: 40,
          completed: 30,
          auto_finished: 2,
          average_score: 7.5,
        },
      },
    });

    await waitFor(() => expect(screen.getByText("8")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    expect(screen.getByText("40")).toBeInTheDocument();
  });
});
