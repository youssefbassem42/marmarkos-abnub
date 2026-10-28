/**
 * The pages of the quiz.
 *
 * The page of the attempt is the most important screen of the module:
 * it shows the questions, it saves the answers and it hands the member
 * over to the result. It is the screen where the end-to-end tests found
 * two real defects - the page is now rendered here too, so a third one
 * does not reach the members.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderPage } from "@/test/pageHarness";
import {
  ATTEMPT_RESUME,
  ATTEMPT_RESULT,
  QUIZ_TAKE,
} from "@/test/fixtures/quiz";
import { clearQuizDraft } from "@/modules/quiz/lib/attemptDraft";
import QuizAttemptPage from "@/modules/quiz/pages/QuizAttemptPage";
import QuizResultPage from "@/modules/quiz/pages/QuizResultPage";

const QUIZ_ID = "quiz-1";
const ATTEMPT_ID = "attempt-1";

const TAKE = {
  ...QUIZ_TAKE,
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
      answered: false,
      selected_option_id: null,
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
      answered: false,
      selected_option_id: null,
      options: [
        { id: "o3", option_text: "يوحنا", position: 1 },
        { id: "o4", option_text: "متّى", position: 2 },
      ],
    },
  ],
};

const ATTEMPT = {
  ...ATTEMPT_RESUME,
  id: ATTEMPT_ID,
  quiz_id: QUIZ_ID,
  status: "IN_PROGRESS" as const,
  total_points: 10,
  started_at: "2026-10-27T10:00:00Z",
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

  it("submits the attempt by itself when the time is up", async () => {
    // The server refuses every answer once the budget of the attempt is
    // exhausted: an attempt that is not submitted would stay in progress
    // for ever. The page submits it by itself (the decision of the
    // product: the quiz ends when the time is up).
    const { calls } = renderPage(<QuizAttemptPage />, {
      path: "/quizzes/:quizId/attempt",
      route: `/quizzes/${QUIZ_ID}/attempt`,
      answers: {
        [`/quizzes/${QUIZ_ID}/take`]: TAKE,
        "/quiz-attempts": {
          ...ATTEMPT,
          id: ATTEMPT_ID,
          questions: TAKE.questions,
        },
        [`/quiz-attempts/${ATTEMPT_ID}`]: {
          ...ATTEMPT,
          // The budget is over: the countdown starts at zero.
          remaining_seconds: 0,
          questions: TAKE.questions,
        },
        [`/quiz-attempts/${ATTEMPT_ID}/submit`]: {
          ...ATTEMPT_RESULT,
          attempt_id: ATTEMPT_ID,
          quiz_id: QUIZ_ID,
        },
      },
    });

    await waitFor(
      () =>
        expect(
          calls.some(
            (call) =>
              call.method === "post" &&
              call.url.includes(`/quiz-attempts/${ATTEMPT_ID}/submit`),
          ),
        ).toBe(true),
      { timeout: 5_000 },
    );
  });

  it("warns the member in the last ten seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
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
          [`/quiz-attempts/${ATTEMPT_ID}`]: {
            ...ATTEMPT,
            // Twelve seconds of budget: the toast appears at ten.
            remaining_seconds: 12,
            questions: TAKE.questions,
          },
        },
      });

      await waitFor(
        () => expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument(),
        { timeout: 5_000 },
      );

      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      await waitFor(
        () =>
          expect(
            screen.getByText(/باقي 10 ثانية فقط|سيُسلَّم الاختبار تلقائيًا/),
          ).toBeInTheDocument(),
        { timeout: 5_000 },
      );
    } finally {
      vi.useRealTimers();
    }
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
          ...ATTEMPT_RESULT,
          attempt_id: ATTEMPT_ID,
          status: "COMPLETED",
          score: 8,
          total_points: 10,
          correct_count: 1,
          incorrect_count: 1,
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

  it("sends the member back to the verse of the quiz", async () => {
    // The button used to build the address with the id of the **quiz**
    // (`/bible-verses/<quiz id>`): the route of the verse expects the
    // id of the verse, so the button led to a page that does not exist.
    renderPage(<QuizResultPage />, {
      path: "/quizzes/:quizId/result",
      route: `/quizzes/${QUIZ_ID}/result?attemptId=${ATTEMPT_ID}`,
      answers: {
        [`/quiz-attempts/${ATTEMPT_ID}/result`]: {
          ...ATTEMPT_RESULT,
          attempt_id: ATTEMPT_ID,
          quiz_id: QUIZ_ID,
          verse_id: "verse-42",
        },
      },
    });

    const back = await screen.findByRole("link", {
      name: /العودة إلى الآية/,
    });
    expect(back).toHaveAttribute("href", "/bible-verses/verse-42");
  });

  it("shows the review of the attempt", async () => {
    renderPage(<QuizResultPage />, {
      path: "/quizzes/:quizId/result",
      route: `/quizzes/${QUIZ_ID}/result?attemptId=${ATTEMPT_ID}`,
      answers: {
        [`/quiz-attempts/${ATTEMPT_ID}/result`]: ATTEMPT_RESULT,
      },
    });

    // The server sends the review of the attempt under `review` (the
    // page used to read `questions`, a field the server never sent:
    // the review was always empty).
    await waitFor(
      () => expect(screen.getByText("السؤال 1")).toBeInTheDocument(),
      { timeout: 5_000 },
    );

    // The question opens and shows the answer of the member.
    fireEvent.click(screen.getByText("السؤال 1"));

    await waitFor(
      () => expect(screen.getByText("ما هو الكتاب؟")).toBeInTheDocument(),
      { timeout: 5_000 },
    );
  });
});
