/**
 * The pages of the administration of the verses and of the management of
 * a quiz.
 *
 * The servants prepare the verse of the week and the quiz that goes
 * with it here. The screens were rendered by nobody.
 */

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { VERSE_ADMIN_ITEM as VERSE_ADMIN_ITEM_FIXTURE } from "@/test/fixtures/bible";
import BibleManagementPage from "@/modules/bible/pages/admin/BibleManagementPage";
import QuizManagePage from "@/modules/quiz/pages/admin/QuizManagePage";

const VERSE = {
  ...VERSE_ADMIN_ITEM_FIXTURE,
  id: "verse-1",
  title: "آية الاختبار",
  status: "PUBLISHED" as const,
  created_by_user: null,
};

const QUIZ_DETAIL = {
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

describe("the management of the verses", () => {
  it("shows the verses of the administration", async () => {
    renderPage(<BibleManagementPage />, {
      admin: true,
      answers: {
        "/bible-verses": {
          items: [VERSE],
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
        expect(screen.getAllByText("آية الاختبار").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});

describe("the management of a quiz", () => {
  it("shows the quiz and its questions", async () => {
    renderPage(<QuizManagePage />, {
      admin: true,
      route: "/admin/quizzes/quiz-1/manage",
      path: "/admin/quizzes/:quizId/manage",
      answers: {
        "/quizzes/quiz-1": QUIZ_DETAIL,
        "/quizzes/quiz-1/validation": {
          is_publishable: false,
          rules: [
            { code: "has_questions", passed: true, detail: "يوجد سؤال" },
            { code: "has_correct_answer", passed: false, detail: "لا توجد" },
          ],
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getAllByText("اختبار الآية").length).toBeGreaterThan(0),
      { timeout: 5_000 },
    );
  });
});
