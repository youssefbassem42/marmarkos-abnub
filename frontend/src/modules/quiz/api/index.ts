/**
 * Quiz API client
 */

import { apiClient } from "@/lib/api";
import type {
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

export const quizApi = {
  /** Manager list of quizzes with filters */
  getQuizzes: async (
    params?: Record<string, unknown>,
  ): Promise<Paginated<QuizAdminItem>> => {
    const response = await apiClient.get("/quizzes", { params });
    return response.data;
  },

  /** Create a new quiz */
  createQuiz: async (data: CreateQuizPayload): Promise<QuizAdminItem> => {
    const response = await apiClient.post("/quizzes", data);
    return response.data;
  },

  /** Quiz detail with questions (manager) */
  getQuiz: async (quizId: string): Promise<QuizDetailResponse> => {
    const response = await apiClient.get(`/quizzes/${quizId}`);
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
    const response = await apiClient.post(`/quizzes/${quizId}/publish`);
    return response.data;
  },

  /** Archive a quiz */
  archiveQuiz: async (quizId: string): Promise<QuizAdminItem> => {
    const response = await apiClient.post(`/quizzes/${quizId}/archive`);
    return response.data;
  },

  /** Quiz readiness checklist */
  validateQuiz: async (quizId: string): Promise<QuizValidationResponse> => {
    const response = await apiClient.get(`/quizzes/${quizId}/validation`);
    return response.data;
  },

  /** Get quiz by associated verse */
  getQuizByVerse: async (verseId: string): Promise<QuizDetailResponse> => {
    const response = await apiClient.get(`/quizzes/by-verse/${verseId}`);
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
    const response = await apiClient.get("/quizzes/analytics/overview");
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
  deleteQuestion: async (
    quizId: string,
    questionId: string,
  ): Promise<void> => {
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
    const response = await apiClient.get(`/quizzes/${quizId}`);
    return response.data;
  },

  // --- Attempts ---

  /** Start a quiz attempt */
  startAttempt: async (
    quizId: string,
  ): Promise<AttemptStartResponse> => {
    const response = await apiClient.post("/quiz-attempts", { quiz_id: quizId });
    return response.data;
  },

  /** Get attempt status */
  getAttemptStatus: async (
    attemptId: string,
  ): Promise<AttemptStatusResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}`);
    return response.data;
  },

  /** Save an answer for a question */
  saveAnswer: async (
    attemptId: string,
    questionId: string,
    selectedOptionId: string,
  ): Promise<void> => {
    await apiClient.put(
      `/quiz-attempts/${attemptId}/answers/${questionId}`,
      { selected_option_id: selectedOptionId },
    );
  },

  /** Submit the attempt for grading */
  submitAttempt: async (
    attemptId: string,
  ): Promise<AttemptResultResponse> => {
    const response = await apiClient.post(`/quiz-attempts/${attemptId}/submit`);
    return response.data;
  },

  /** Get graded result */
  getResult: async (
    attemptId: string,
  ): Promise<AttemptResultResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}/result`);
    return response.data;
  },

  /** Get review with correct answers */
  getReview: async (
    attemptId: string,
  ): Promise<AttemptReviewResponse> => {
    const response = await apiClient.get(`/quiz-attempts/${attemptId}/review`);
    return response.data;
  },

  /** Force-expire an attempt (admin) */
  expireAttempt: async (attemptId: string): Promise<void> => {
    await apiClient.post(`/quiz-attempts/${attemptId}/expire`);
  },
};
