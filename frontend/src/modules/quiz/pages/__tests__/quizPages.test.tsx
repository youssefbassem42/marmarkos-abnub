/**
 * The pages of the quiz.
 *
 * The page of the attempt is the most important screen of the module:
 * it shows the questions, it saves the answers and it hands the member
 * over to the result. It is the screen where the end-to-end tests found
 * two real defects - the page is now rendered here too, so a third one
 * does not reach the members.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { renderPage } from "@/test/pageHarness";
import { clearQuizDraft } from "@/modules/quiz/lib/attemptDraft";
import QuizAttemptPage from "@/modules/quiz/pages/QuizAttemptPage";
import QuizResultPage from "@/modules/quiz/pages/QuizResultPage";

const QUIZ_ID = "quiz-1";
const ATTEMPT_ID = "attempt-1";

const TAKE = {
  id: QUIZ_ID,
  title: "اختبار الآية",
  description: "اختبار على آية اليوم",
  duration_seconds: 600,
  total_points: 10,
  question_count: 2,
  attempt_id: null,
  questions: [
    {
      id: "q1",
      question: "ما هو الكتاب؟",
      points: 5,
      position: 1,
      options: [
        { id: "o1", option_text: "إنجيل متى", position: 1 },
        { id: "o2", option_text: "إنجيل لوقا", position: 2 },
      ],
    },
    {
      id: "q2",
      question: "من هو الكاتب؟",
      points: 5,
      position: 2,
      options: [
        { id: "o3", option_text: "يوحنا", position: 1 },
        { id: "o4", option_text: "متّى", position: 2 },
      ],
    },
  ],
};

const ATTEMPT = {
  id: ATTEMPT_ID,
  quiz_id: QUIZ_ID,
  user_id: "u1",
  status: "IN_PROGRESS" as const,
  score: 0,
  total_points: 10,
  started_at: "2026-10-27T10:00:00Z",
  submitted_at: null,
  remaining_seconds: 540,
  server_time: "2026-10-27T10:01:00Z",
  questions: [],
};

beforeEach(() => {
  clearQuizDraft(QUIZ_ID);
  window.localStorage.clear();
});

describe("the page of the attempt", () => {
  it("shows the questions of the quiz", async () => {
    renderPage(<QuizAttemptPage />, {
      path: "/quizzes/:quizId/attempt",
      route: `/quizzes/${QUIZ_ID}/attempt`,
      answers: {
        [`/quizzes/${QUIZ_ID}/take`]: TAKE,
        "/quiz-attempts": {
          ...ATTEMPT,
          id: ATTEMPT_ID,
          questions: TAKE.questions,
        },
        [`/quiz-attempts/${ATTEMPT_ID}`]: ATTEMPT,
      },
    });

    await waitFor(
      () => expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    expect(screen.getByText("إنجيل متى")).toBeInTheDocument();
  });

  it("never shows the correctness of an option to the member", async () => {
    renderPage(<QuizAttemptPage />, {
      path: "/quizzes/:quizId/attempt",
      route: `/quizzes/${QUIZ_ID}/attempt`,
      answers: {
        [`/quizzes/${QUIZ_ID}/take`]: TAKE,
        "/quiz-attempts": { ...ATTEMPT, id: ATTEMPT_ID },
        [`/quiz-attempts/${ATTEMPT_ID}`]: ATTEMPT,
      },
    });

    await waitFor(
      () => expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    // The take payload carries no "is_correct" at all - the member
    // cannot read the answer of the question from the page.
    expect(screen.queryByText(/صحيح|خطأ|إجابة صحيحة/)).not.toBeInTheDocument();
  });

  it("continues the attempt the server knows", async () => {
    const { calls } = renderPage(<QuizAttemptPage />, {
      path: "/quizzes/:quizId/attempt",
      route: `/quizzes/${QUIZ_ID}/attempt`,
      answers: {
        [`/quizzes/${QUIZ_ID}/take`]: { ...TAKE, attempt_id: ATTEMPT_ID },
        [`/quiz-attempts/${ATTEMPT_ID}`]: ATTEMPT,
      },
    });

    await waitFor(
      () =>
        expect(
          calls.some((call) => call.url === `/quiz-attempts/${ATTEMPT_ID}`),
        ).toBe(true),
      { timeout: 5_000 },
    );
    // The page did not start a second attempt.
    expect(calls.some((call) => call.url === "/quiz-attempts")).toBe(false);
  });

  it("sends the answer of the member", async () => {
    const { calls } = renderPage(<QuizAttemptPage />, {
      path: "/quizzes/:quizId/attempt",
      route: `/quizzes/${QUIZ_ID}/attempt`,
      answers: {
        [`/quizzes/${QUIZ_ID}/take`]: { ...TAKE, attempt_id: ATTEMPT_ID },
        [`/quiz-attempts/${ATTEMPT_ID}`]: ATTEMPT,
      },
    });

    await waitFor(
      () => expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
    // A plain click: userEvent's full pointer sequence does not reach
    // the radio of Radix inside a <label> in jsdom (the end-to-end
    // test drives the same radio in a real browser).
    fireEvent.click(screen.getAllByRole("radio")[0]);

    await waitFor(
      () =>
        expect(
          calls.some(
            (call) =>
              call.method === "put" &&
              call.url.includes(`/quiz-attempts/${ATTEMPT_ID}/answers`),
          ),
        ).toBe(true),
      { timeout: 5_000 },
    );
  });
});

describe("the page of the result", () => {
  it("shows the score of the member", async () => {
    renderPage(<QuizResultPage />, {
      path: "/quizzes/:quizId/result",
      route: `/quizzes/${QUIZ_ID}/result?attemptId=${ATTEMPT_ID}`,
      answers: {
        [`/quiz-attempts/${ATTEMPT_ID}/result`]: {
          id: ATTEMPT_ID,
          status: "COMPLETED",
          score: 8,
          total_points: 10,
          correct_count: 1,
          incorrect_count: 1,
          duration_seconds: 120,
          questions: [],
        },
      },
    });

    await waitFor(() => expect(screen.getByText("80%")).toBeInTheDocument(), {
      timeout: 5_000,
    });
    // The number of the correct and of the wrong answers.
    expect(screen.getByText("إجابات صحيحة")).toBeInTheDocument();
    expect(screen.getByText("إجابات خاطئة")).toBeInTheDocument();
  });
});
