/**
 * The draft of an attempt in progress (the resume of a quiz).
 *
 * The member answers, the page is refreshed (or React remounts the
 * route): the answers must be checked again and the page must open on
 * the last question the member solved - not on the first one.
 *
 * The draft lives in `localStorage` so it survives the refresh. It holds
 * no credential: the access token is in the memory (SEC-004) and the
 * refresh cookie is HttpOnly.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearQuizDraft,
  readQuizDraft,
  resumeIndex,
  writeQuizDraft,
} from "@/modules/quiz/lib/attemptDraft";

const QUIZ = "quiz-1";
const OTHER_QUIZ = "quiz-2";

beforeEach(() => {
  localStorage.clear();
});

describe("the draft of an attempt", () => {
  it("is empty when nothing was written", () => {
    expect(readQuizDraft(QUIZ)).toBeNull();
  });

  it("keeps the attempt, the answers and the question", () => {
    writeQuizDraft({
      attemptId: "attempt-1",
      quizId: QUIZ,
      answers: { q1: "opt-a" },
      currentIndex: 1,
      savedAt: 1_700_000_000_000,
    });

    const draft = readQuizDraft(QUIZ);
    expect(draft?.attemptId).toBe("attempt-1");
    expect(draft?.answers).toEqual({ q1: "opt-a" });
    expect(draft?.currentIndex).toBe(1);
  });

  it("survives a refresh of the page", () => {
    writeQuizDraft({
      attemptId: "attempt-1",
      quizId: QUIZ,
      answers: { q1: "opt-a" },
      currentIndex: 1,
      savedAt: 1_700_000_000_000,
    });

    // A refresh empties the memory, not the storage.
    const draft = readQuizDraft(QUIZ);
    expect(draft).not.toBeNull();
  });

  it("keeps the drafts of two quizzes apart", () => {
    writeQuizDraft({
      attemptId: "attempt-1",
      quizId: QUIZ,
      answers: {},
      currentIndex: 0,
      savedAt: 1,
    });
    writeQuizDraft({
      attemptId: "attempt-2",
      quizId: OTHER_QUIZ,
      answers: {},
      currentIndex: 0,
      savedAt: 1,
    });

    expect(readQuizDraft(QUIZ)?.attemptId).toBe("attempt-1");
    expect(readQuizDraft(OTHER_QUIZ)?.attemptId).toBe("attempt-2");
  });

  it("is removed when the attempt is over", () => {
    writeQuizDraft({
      attemptId: "attempt-1",
      quizId: QUIZ,
      answers: {},
      currentIndex: 0,
      savedAt: 1,
    });

    clearQuizDraft(QUIZ);

    expect(readQuizDraft(QUIZ)).toBeNull();
  });

  it("ignores a broken draft instead of breaking the quiz", () => {
    localStorage.setItem(`marmarkos.quiz.draft.${QUIZ}`, "{not json");

    expect(readQuizDraft(QUIZ)).toBeNull();
  });

  it("ignores a draft of another quiz", () => {
    localStorage.setItem(
      `marmarkos.quiz.draft.${QUIZ}`,
      JSON.stringify({
        attemptId: "attempt-1",
        quizId: OTHER_QUIZ,
        answers: {},
        currentIndex: 0,
        savedAt: 1,
      }),
    );

    expect(readQuizDraft(QUIZ)).toBeNull();
  });

  it("ignores a draft without an attempt", () => {
    localStorage.setItem(
      `marmarkos.quiz.draft.${QUIZ}`,
      JSON.stringify({ quizId: QUIZ, answers: {}, currentIndex: 0 }),
    );

    expect(readQuizDraft(QUIZ)).toBeNull();
  });
});

describe("the question the page opens on", () => {
  const questions = ["q1", "q2", "q3"];

  it("is the first question when nothing is answered", () => {
    expect(resumeIndex(questions, {})).toBe(0);
  });

  it("is the first question without an answer", () => {
    expect(resumeIndex(questions, { q1: "opt-a" })).toBe(1);
  });

  it("is the last question the member solved", () => {
    expect(resumeIndex(questions, { q1: "opt-a", q2: "opt-b" })).toBe(2);
  });

  it("stays on the last question when every question is answered", () => {
    const answers = { q1: "opt-a", q2: "opt-b", q3: "opt-c" };
    expect(resumeIndex(questions, answers)).toBe(2);
  });

  it("never leaves the range of the questions", () => {
    expect(resumeIndex([], {})).toBe(0);
    expect(resumeIndex([], { q1: "opt-a" })).toBe(0);
  });
});
