/**
 * The analysis of the quizzes in the administration.
 *
 * The page brings the quizzes together, opens the analysis of one quiz,
 * and lets the administration take the results away as a CSV file.
 */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "@/lib/download";
import { renderPage } from "@/test/pageHarness";
import {
  EMPTY_QUIZ_ANALYTICS,
  EMPTY_QUIZ_ANALYTICS_USERS,
  QUIZ_ANALYTICS,
  QUIZ_ANALYTICS_LIST,
  QUIZ_ANALYTICS_OVERVIEW,
  QUIZ_ANALYTICS_USERS,
} from "@/test/fixtures/quiz";
import QuizAnalyticsPage from "@/modules/quiz/pages/admin/QuizAnalyticsPage";

vi.mock("@/lib/download", () => ({
  downloadBlob: vi.fn(),
}));

const mockedDownloadBlob = vi.mocked(downloadBlob);

const OVERVIEW = QUIZ_ANALYTICS_OVERVIEW;
const LIST = QUIZ_ANALYTICS_LIST;

function renderAnalytics(
  answers: Record<string, unknown>,
  route = "/admin/analytics/quizzes",
) {
  return renderPage(<QuizAnalyticsPage />, {
    admin: true,
    route,
    answers: {
      "/quizzes/analytics/overview": OVERVIEW,
      ...answers,
    },
  });
}

describe("the analysis of the quizzes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the quizzes and their numbers in a table", async () => {
    renderAnalytics({
      "/quizzes/quiz-1/analytics": QUIZ_ANALYTICS,
      "/quizzes": LIST,
    });

    const table = await screen.findByRole("table", undefined, {
      timeout: 5_000,
    });

    expect(within(table).getByText("اختبار الآية")).toBeInTheDocument();
    expect(within(table).getByText("منشور")).toBeInTheDocument();
    expect(await within(table).findByText("٨")).toBeInTheDocument();
    expect(within(table).getByText("٧٫٥ من ١٠")).toBeInTheDocument();
    const analysisLinks = within(table).getAllByRole("link", {
      name: "عرض تحليل اختبار الآية",
    });
    expect(analysisLinks).toHaveLength(2);
    analysisLinks.forEach((link) =>
      expect(link).toHaveAttribute(
        "href",
        "/admin/analytics/quizzes?quiz=quiz-1",
      ),
    );
  });

  it("opens the analysis of one quiz with the result of every member", async () => {
    renderAnalytics(
      {
        "/quizzes/quiz-1/analytics/users": QUIZ_ANALYTICS_USERS,
        "/quizzes/quiz-1/analytics": QUIZ_ANALYTICS,
        "/quizzes": LIST,
      },
      "/admin/analytics/quizzes?quiz=quiz-1",
    );

    expect(
      await screen.findByRole("heading", { name: "تحليل الاختبار" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("أحمد محمد")).toBeInTheDocument();
    expect(screen.getByText("فاطمة علي")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "نتائج الأعضاء" }),
    ).toBeInTheDocument();
    expect(screen.getByText("توزيع الدرجات")).toBeInTheDocument();
    expect(screen.getByText("حالة الإكمال")).toBeInTheDocument();
  });

  it("opens the analysis from the existing quiz link", async () => {
    renderAnalytics(
      {
        "/quizzes/quiz-1/analytics/users": QUIZ_ANALYTICS_USERS,
        "/quizzes/quiz-1/analytics": QUIZ_ANALYTICS,
        "/quizzes": LIST,
      },
      "/admin/analytics/quizzes?quizId=quiz-1",
    );

    expect(
      await screen.findByRole("heading", { name: "تحليل الاختبار" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("أحمد محمد")).toBeInTheDocument();
  });

  it("says that there are no quizzes", async () => {
    renderAnalytics({
      "/quizzes": { ...LIST, items: [], total: 0 },
    });

    expect(
      await screen.findByText("لا توجد اختبارات بعد", undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
  });

  it("says that the selected quiz has no attempts", async () => {
    renderAnalytics(
      {
        "/quizzes/quiz-1/analytics/users": EMPTY_QUIZ_ANALYTICS_USERS,
        "/quizzes/quiz-1/analytics": EMPTY_QUIZ_ANALYTICS,
        "/quizzes": LIST,
      },
      "/admin/analytics/quizzes?quiz=quiz-1",
    );

    expect(
      await screen.findByText("لا توجد محاولات بعد", undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("هذا الاختبار لم يُخض بعد.")).toBeInTheDocument();
  });

  it("shows the error state when the list fails", async () => {
    renderAnalytics({
      "/quizzes": { status: 500 },
    });

    expect(
      await screen.findByRole("button", { name: "حاول مرة تاني" }),
    ).toBeInTheDocument();
  });

  it("asks the server for the chosen page of quizzes", async () => {
    const user = userEvent.setup();
    const { calls } = renderAnalytics({
      "/quizzes/quiz-1/analytics": QUIZ_ANALYTICS,
      "/quizzes": { ...LIST, pages: 3 },
    });

    await user.click(await screen.findByRole("link", { name: "2" }));

    await waitFor(
      () =>
        expect(
          calls.some(
            (call) =>
              call.url === "/quizzes" &&
              typeof call.params === "object" &&
              call.params !== null &&
              "page" in call.params &&
              call.params.page === 2,
          ),
        ).toBe(true),
      { timeout: 5_000 },
    );
  });

  it("exports the results of the selected quiz", async () => {
    const user = userEvent.setup();
    const csv = new Blob(["العضو,الدرجة\nأحمد,10"], {
      type: "text/csv;charset=utf-8",
    });
    const { calls } = renderAnalytics(
      {
        "/quizzes/quiz-1/analytics/export": csv,
        "/quizzes/quiz-1/analytics/users": QUIZ_ANALYTICS_USERS,
        "/quizzes/quiz-1/analytics": QUIZ_ANALYTICS,
        "/quizzes": LIST,
      },
      "/admin/analytics/quizzes?quiz=quiz-1",
    );

    await user.click(await screen.findByRole("button", { name: "تصدير CSV" }));

    await waitFor(
      () =>
        expect(
          calls.some((call) => call.url === "/quizzes/quiz-1/analytics/export"),
        ).toBe(true),
      { timeout: 5_000 },
    );
    expect(mockedDownloadBlob).toHaveBeenCalledWith(
      csv,
      "quiz-quiz-1-results.csv",
    );
  });
});
