/**
 * The table of the questions of a quiz, and the page that writes one.
 *
 * The table is the list the servant works with: the questions are
 * ordered, they can be moved, copied and deleted. The page of the
 * question is the form plus a preview and the panel of the validation.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { QuestionTable } from "@/modules/quiz/components/admin/QuestionTable";
import QuestionFormPage from "@/modules/quiz/pages/admin/QuestionFormPage";

const QUESTIONS = [
  {
    id: "q1",
    question: "ما هو الكتاب؟",
    points: 5,
    position: 1,
    options: [
      { id: "o1", option_text: "إنجيل متى", is_correct: true, position: 1 },
      { id: "o2", option_text: "إنجيل لوقا", is_correct: false, position: 2 },
    ],
  },
  {
    id: "q2",
    question: "من كتبه؟",
    points: 5,
    position: 2,
    options: [
      { id: "o3", option_text: "متى", is_correct: true, position: 1 },
      { id: "o4", option_text: "لوقا", is_correct: false, position: 2 },
    ],
  },
];

describe("the table of the questions", () => {
  it("lists the questions in their order", () => {
    renderPage(<QuestionTable quizId="quiz-1" questions={QUESTIONS} />, {
      admin: true,
    });

    const rows = screen.getAllByRole("row");
    // The header plus the two questions.
    expect(rows).toHaveLength(3);
    expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument();
    expect(screen.getByText("من كتبه؟")).toBeInTheDocument();
  });

  it("asks before deleting a question", async () => {
    renderPage(<QuestionTable quizId="quiz-1" questions={QUESTIONS} />, {
      admin: true,
    });

    const deleteButtons = screen.getAllByRole("button", {
      name: /حذف|delete/i,
    });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(deleteButtons[0]);

    // The confirmation opens; nothing was deleted yet.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /تأكيد|confirm|حذف/i }),
      ).toBeInTheDocument(),
    );
  });
});

describe("the page of a question", () => {
  it("shows the question that is edited", async () => {
    renderPage(<QuestionFormPage />, {
      admin: true,
      route: "/admin/quizzes/quiz-1/questions/q1/edit",
      path: "/admin/quizzes/:quizId/questions/:questionId/edit",
      answers: {
        "/quizzes/quiz-1": {
          id: "quiz-1",
          title: "اختبار الآية",
          questions: QUESTIONS,
        },
      },
    });

    await waitFor(
      () =>
        expect(screen.getByDisplayValue("ما هو الكتاب؟")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(screen.getByDisplayValue("إنجيل متى")).toBeInTheDocument();
  });
});
