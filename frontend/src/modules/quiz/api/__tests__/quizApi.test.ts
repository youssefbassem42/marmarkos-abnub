/**
 * The quiz client.
 *
 * Every method of the client is one endpoint of the API: a wrong URL
 * or a wrong body is a defect the backend tests cannot see (they call
 * the server directly, not this client).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  onlyCall,
  recordApiCalls,
  type RecordingAdapter,
} from "@/test/recordingAdapter";

import { quizApi } from "../index";

let recorder: RecordingAdapter;

beforeEach(() => {
  recorder = recordApiCalls({ id: "quiz-1" });
});

afterEach(() => {
  recorder.restore();
});

describe("quizApi - the manager endpoints", () => {
  it("lists the quizzes with their filters", async () => {
    await quizApi.getQuizzes({ page: 2, size: 10 });

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("get");
    expect(call.url).toBe("/quizzes");
    expect(call.params).toEqual({ page: 2, size: 10 });
  });

  it("creates a quiz", async () => {
    await quizApi.createQuiz({ title: "Quiz" } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/quizzes");
    expect(call.data).toBe(JSON.stringify({ title: "Quiz" }));
  });

  it("reads, updates, publishes and archives one quiz", async () => {
    await quizApi.getQuiz("q1");
    await quizApi.updateQuiz("q1", { title: "New" } as never);
    await quizApi.publishQuiz("q1");
    await quizApi.archiveQuiz("q1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "get /quizzes/q1",
      "patch /quizzes/q1",
      "post /quizzes/q1/publish",
      "post /quizzes/q1/archive",
    ]);
  });

  it("asks for the validation checklist and the analytics", async () => {
    await quizApi.validateQuiz("q1");
    await quizApi.getQuizAnalytics("q1");
    await quizApi.getAnalyticsOverview();

    expect(recorder.calls.map((call) => call.url)).toEqual([
      "/quizzes/q1/validation",
      "/quizzes/q1/analytics",
      "/quizzes/analytics/overview",
    ]);
  });

  it("finds the quiz of a verse", async () => {
    await quizApi.getQuizByVerse("v1");

    expect(onlyCall(recorder.calls).url).toBe("/quizzes/by-verse/v1");
  });
});

describe("quizApi - the questions", () => {
  it("adds a question to a quiz", async () => {
    await quizApi.createQuestion("q1", { question: "Q" } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/quizzes/q1/questions");
  });

  it("updates a question on its own route", async () => {
    await quizApi.updateQuestion("q1", "question-1", {
      question: "Q",
    } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("patch");
    expect(call.url).toBe("/quiz-questions/question-1");
  });

  it("deletes and duplicates a question", async () => {
    await quizApi.deleteQuestion("q1", "question-1");
    await quizApi.duplicateQuestion("q1", "question-1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "delete /quiz-questions/question-1",
      "post /quiz-questions/question-1/duplicate",
    ]);
  });

  it("reorders the questions of a quiz", async () => {
    await quizApi.reorderQuestions("q1", { question_ids: ["a", "b"] } as never);

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("put");
    expect(call.url).toBe("/quizzes/q1/questions/reorder");
  });
});

describe("quizApi - the attempts of a member", () => {
  it("starts an attempt with the quiz id", async () => {
    await quizApi.startAttempt("q1");

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/quiz-attempts");
    expect(call.data).toBe(JSON.stringify({ quiz_id: "q1" }));
  });

  it("saves the selected option of a question", async () => {
    await quizApi.saveAnswer("a1", "question-1", "option-2");

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("put");
    expect(call.url).toBe("/quiz-attempts/a1/answers/question-1");
    expect(call.data).toBe(JSON.stringify({ selected_option_id: "option-2" }));
  });

  it("charges the active time with a heartbeat", async () => {
    await quizApi.heartbeatAttempt("a1");

    const call = onlyCall(recorder.calls);
    expect(call.method).toBe("post");
    expect(call.url).toBe("/quiz-attempts/a1/heartbeat");
  });

  it("submits an attempt and reads its result and its review", async () => {
    await quizApi.submitAttempt("a1");
    await quizApi.getResult("a1");
    await quizApi.getReview("a1");
    await quizApi.getAttemptStatus("a1");

    expect(recorder.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "post /quiz-attempts/a1/submit",
      "get /quiz-attempts/a1/result",
      "get /quiz-attempts/a1/review",
      "get /quiz-attempts/a1",
    ]);
  });
});
