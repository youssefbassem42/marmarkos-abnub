/**
 * The builder of the quizzes.
 *
 * The biggest page of the platform (609 statements): the servant builds
 * the quiz of the week here - the information, the questions, the
 * publication. It was rendered by nobody.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import QuizBuilderPage from "@/modules/quiz/pages/admin/QuizBuilderPage";

const QUIZ = {
  id: "quiz-1",
  title: "اختبار الآية",
  verse_reference: "١ يوئيل ٣:١",
  verse_id: "verse-1",
  total_points: 10,
  duration_seconds: 600,
  question_count: 1,
  status: "DRAFT" as const,
  published_at: null,
  created_at: "2026-10-01T00:00:00Z",
  description: "اختبار على آية اليوم",
  questions: [
    {
      id: "q1",
      question: "ما هو الكتاب؟",
      points: 10,
      position: 1,
      options: [
        { id: "o1", option_text: "إنجيل متى", is_correct: true, position: 1 },
        { id: "o2", option_text: "إنجيل لوقا", is_correct: false, position: 2 },
      ],
    },
  ],
};

const VERSE = {
  id: "verse-1",
  title: "آية الاختبار",
  subtitle: null,
  verse_reference: "١ يوئيل ٣:١",
  book: "يوئيل",
  chapter: 3,
  verse_start: 1,
  verse_end: null,
  status: "PUBLISHED" as const,
  published_at: "2026-10-20T00:00:00Z",
  week_start_date: "2026-10-19",
  created_by_user: null,
  created_at: "2026-10-01T00:00:00Z",
  text: "اقرؤوا لي يا سيدي...",
  reflection: "تأمل في الآية",
  image: null,
  translation: "الترجمة",
  opens: 12,
  is_read: true,
  quiz_summary: null,
  schedule: null,
};

describe("the builder of the quizzes", () => {
  it("shows the quiz that is edited", async () => {
    renderPage(<QuizBuilderPage />, {
      admin: true,
      route: "/admin/quizzes/quiz-1/build",
      path: "/admin/quizzes/:quizId/build",
      answers: {
        "/bible-verses/verse-1": VERSE,
        "/quizzes/quiz-1/validation": {
          is_publishable: false,
          rules: [
            { code: "has_questions", passed: true, detail: "يوجد سؤال" },
            { code: "has_options", passed: true, detail: "توجد خيارات" },
          ],
        },
        "/quizzes/quiz-1": QUIZ,
      },
    });

    await waitFor(
      () =>
        expect(screen.getByDisplayValue("اختبار الآية")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });

  it("shows the questions of the quiz", async () => {
    renderPage(<QuizBuilderPage />, {
      admin: true,
      route: "/admin/quizzes/quiz-1/build",
      path: "/admin/quizzes/:quizId/build",
      answers: {
        "/bible-verses/verse-1": VERSE,
        "/quizzes/quiz-1/validation": {
          is_publishable: false,
          rules: [
            { code: "has_questions", passed: true, detail: "يوجد سؤال" },
            { code: "has_options", passed: true, detail: "توجد خيارات" },
          ],
        },
        "/quizzes/quiz-1": QUIZ,
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("ما هو الكتاب؟").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});
