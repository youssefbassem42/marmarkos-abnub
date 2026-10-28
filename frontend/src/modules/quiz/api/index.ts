/**
 * Quiz API client
 */

import { apiClient } from "@/lib/api";
import { paginated } from "@/lib/schemas/common";
import {
  attemptHeartbeatSchema,
  attemptResultSchema,
  attemptResumeSchema,
  attemptReviewSchema,
  attemptStartSchema,
  quizAdminItemSchema,
  quizAnalyticsOverviewSchema,
  quizDetailSchema,
  quizTakeSchema,
  quizValidationSchema,
} from "@/lib/schemas/quiz";
import type {
  AttemptHeartbeatResponse,
  AttemptResultResponse,
  AttemptReviewResponse,
  AttemptStartResponse,
  AttemptStatusResponse,
  CreateQuestionPayload,
  CreateQuizPayload,
  Paginated,
  QuizAdminItem,
  QuizDetailResponse,
  QuizTakeResponse,
  QuizValidationResponse,
  ReorderQuestionsPayload,
  UpdateQuestionPayload,
  UpdateQuizPayload,
} from "../types";
import { rememberAttempt } from "../lib/attemptDraft";

export const quizApi = {
  /** Manager list of quizzes with filters */
  getQuizzes: async (
    params?: Record<string, unknown>,
  ): Promise<Paginated<QuizAdminItem>> => {
    const response = await apiClient.get("/quizzes", {
      params,
      schema: paginated(quizAdminItemSchema),
    });
    return response.data;
  },

  /** Create a new quiz */
  createQuiz: async (data: CreateQuizPayload): Promise<QuizAdminItem> => {
    const response = await apiClient.post("/quizzes", data);
    return response.data;
  },

  /** Quiz detail with questions (manager) */
  getQuiz: async (quizId: string): Promise<QuizDetailResponse> => {
    const response = await apiClient.get(`/quizzes/${quizId}`, {
      schema: quizDetailSchema,
    });
    return response.data;
  },

  /** Update quiz metadata */
  updateQuiz: async (
    quizId: string,
    data: UpdateQuizPayload,
  ): Promise<QuizAdminItem> => {
    const response = await apiClient.patch(`/quizzes/${quizId}`, data);
    return response.data;
  },

  /** Publish a quiz */
  publishQuiz: async (quizId: string): Promise<QuizAdminItem> => {
    const response = await apiClient.post(
      `/quizzes/${quizId}/publish`,
      undefined,
      {
        schema: quizAdminItemSchema,
      },
    );
    return response.data;
  },

  /** Archive a quiz */
  archiveQuiz: async (quizId: string): Promise<QuizAdminItem> => {
    const response = await apiClient.post(
      `/quizzes/${quizId}/archive`,
      undefined,
      {
        schema: quizAdminItemSchema,
      },
    );
    return response.data;
  },

  /** Quiz readiness checklist */
  validateQuiz: async (quizId: string): Promise<QuizValidationResponse> => {
    const response = await apiClient.get(`/quizzes/${quizId}/validation`, {
      schema: quizValidationSchema,
    });
    return response.data;
  },

  /** Get quiz by associated verse */
  getQuizByVerse: async (verseId: string): Promise<QuizDetailResponse> => {
    const response = await apiClient.get(`/quizzes/by-verse/${verseId}`, {
      schema: quizDetailSchema,
    });
    return response.data;
  },

  /** Get quiz analytics */
  getQuizAnalytics: async (
    quizId: string,
  ): Promise<Record<string, unknown>> => {
    const response = await apiClient.get(`/quizzes/${quizId}/analytics`);
    return response.data;
  },

  /** Aggregate quiz stats for the admin dashboard */
  getAnalyticsOverview: async (): Promise<{
    total_quizzes: number;
    published_quizzes: number;
    participants: number;
    completed: number;
    auto_finished: number;
    average_score: number;
  }> => {
    const response = await apiClient.get("/quizzes/analytics/overview", {
      schema: quizAnalyticsOverviewSchema,
    });
    return response.data;
  },

  // --- Questions ---

  /** Add a question to a quiz */
  createQuestion: async (
    quizId: string,
    data: CreateQuestionPayload,
  ): Promise<void> => {
    await apiClient.post(`/quizzes/${quizId}/questions`, data);
  },

  /** Update a question (full options array, stable option ids) */
  updateQuestion: async (
    quizId: string,
    questionId: string,
    data: UpdateQuestionPayload,
  ): Promise<void> => {
    await apiClient.patch(`/quiz-questions/${questionId}`, data);
  },

  /** Delete a question */
  deleteQuestion: async (quizId: string, questionId: string): Promise<void> => {
    await apiClient.delete(`/quiz-questions/${questionId}`);
  },

  /** Reorder questions within a quiz */
  reorderQuestions: async (
    quizId: string,
    data: ReorderQuestionsPayload,
  ): Promise<void> => {
    await apiClient.put(`/quizzes/${quizId}/questions/reorder`, data);
  },

  /** Duplicate a question */
  duplicateQuestion: async (
    quizId: string,
    questionId: string,
  ): Promise<void> => {
    await apiClient.post(`/quiz-questions/${questionId}/duplicate`);
  },

  // --- Member-facing take ---

  /** Get quiz content for taking (no correct answers) */
  getQuizForTake: async (quizId: string): Promise<QuizTakeResponse> => {
    // The take path, not the manager endpoint: the manager detail carries
    // the correctness of every option and is reserved for the servants
    // (a member received a 403 and could not answer the quiz at all).
    const response = await apiClient.get(`/quizzes/${quizId}/take`, {
      schema: quizTakeSchema,
    });
    return response.data;
  },

  // --- Attempts ---

  /** Start a quiz attempt */
  startAttempt: async (quizId: string): Promise<AttemptStartResponse> => {
    const response = await apiClient.post(
      "/quiz-attempts",
      { quiz_id: quizId },
      { schema: attemptStartSchema },
    );
    // The attempt is remembered **here**, inside the request, and not in
    // the callback of the caller: React drops the state of an unmounted
    // component, and a mutation does not call its callbacks when nobody
    // is listening any more. The next page that opens the quiz finds the
    // attempt instead of starting a second one.
    rememberAttempt(quizId, response.data.id);
    return response.data;
  },

  /** Get attempt status */
  getAttemptStatus: async (
    attemptId: string,
  ): Promise<AttemptStatusResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}`, {
      schema: attemptResumeSchema,
    });
    return response.data;
  },

  /** Save an answer; returns the fresh active-time anchor (V2) */
  saveAnswer: async (
    attemptId: string,
    questionId: string,
    selectedOptionId: string,
  ): Promise<AttemptHeartbeatResponse> => {
    const response = await apiClient.put(
      `/quiz-attempts/${attemptId}/answers/${questionId}`,
      { selected_option_id: selectedOptionId },
      { schema: attemptHeartbeatSchema },
    );
    return response.data;
  },

  /** Charge active time while the member is in the quiz (V2) */
  heartbeatAttempt: async (
    attemptId: string,
  ): Promise<AttemptHeartbeatResponse> => {
    const response = await apiClient.post(
      `/quiz-attempts/${attemptId}/heartbeat`,
      undefined,
      { schema: attemptHeartbeatSchema },
    );
    return response.data;
  },

  /** Submit the attempt for grading */
  submitAttempt: async (attemptId: string): Promise<AttemptResultResponse> => {
    const response = await apiClient.post(
      `/quiz-attempts/${attemptId}/submit`,
      undefined,
      { schema: attemptResultSchema },
    );
    return response.data;
  },

  /** Get graded result */
  getResult: async (attemptId: string): Promise<AttemptResultResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}/result`, {
      schema: attemptResultSchema,
    });
    return response.data;
  },

  /** Get review with correct answers */
  getReview: async (attemptId: string): Promise<AttemptReviewResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}/review`, {
      schema: attemptReviewSchema,
    });
    return response.data;
  },
};
