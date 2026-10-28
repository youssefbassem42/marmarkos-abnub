/**
 * Quiz module types
 *
 * Manages quizzes tied to Bible verses: questions, options,
 * and member quiz attempts with grading.
 *
 * The types are the **inference of the schemas** of the answers
 * (`@/lib/schemas/quiz`): the backend is the source of truth, and a
 * field that the server does not send cannot be read by the page.
 */

import type { z } from "zod";

import type {
  attemptHeartbeatSchema,
  attemptResultSchema,
  attemptResumeSchema,
  attemptReviewSchema,
  attemptStartSchema,
  attemptStatusSchema,
  gradedOptionSchema,
  questionOptionSchema,
  questionSchema,
  quizAdminItemSchema,
  quizDetailSchema,
  quizStatusSchema,
  quizTakeSchema,
  quizValidationSchema,
  reviewQuestionSchema,
  takeOptionSchema,
  takeQuestionSchema,
} from "@/lib/schemas/quiz";

export type QuizStatus = z.infer<typeof quizStatusSchema>;

export type AttemptStatus = z.infer<typeof attemptStatusSchema>;

export type QuizAdminItem = z.infer<typeof quizAdminItemSchema>;

export type QuizOptionResponse = z.infer<typeof questionOptionSchema>;

export type QuizQuestionResponse = z.infer<typeof questionSchema>;

export type QuizDetailResponse = z.infer<typeof quizDetailSchema>;

export type QuizValidationRule = z.infer<
  typeof quizValidationSchema
>["rules"][number];

export type QuizValidationResponse = z.infer<typeof quizValidationSchema>;

// --- Member-facing quiz take types (no is_correct) ---

export type QuizTakeOption = z.infer<typeof takeOptionSchema>;

export type QuizTakeQuestion = z.infer<typeof takeQuestionSchema>;

export type QuizTakeResponse = z.infer<typeof quizTakeSchema>;

// --- Attempt types ---

export type AttemptQuestionBrief = QuizTakeQuestion;

export type AttemptStartResponse = z.infer<typeof attemptStartSchema>;

/** Fresh active-time anchor returned by save/heartbeat/resume (V2). */
export type AttemptHeartbeatResponse = z.infer<typeof attemptHeartbeatSchema>;

export type AttemptStatusResponse = z.infer<typeof attemptResumeSchema>;

/** One graded question of the review (`ReviewQuestionItem`). */
export type GradedQuestion = z.infer<typeof reviewQuestionSchema>;

/** One option of a graded question (`GradedOptionItem`). */
export type GradedOption = z.infer<typeof gradedOptionSchema>;

/**
 * The result of an attempt (`AttemptResultResponse`).
 *
 * The answer of the server carries **no** `questions`: the review of
 * the questions is a different answer (the endpoint of the review, which
 * the backend reserves for the servants).
 */
export type AttemptResultResponse = z.infer<typeof attemptResultSchema>;

/** The review of an attempt (the endpoint of the servants). */
export type AttemptReviewResponse = z.infer<typeof attemptReviewSchema>;

// --- Payloads ---

export interface CreateQuizPayload {
  title: string;
  description?: string;
  verse_id: string;
  duration_seconds: number;
}

export interface UpdateQuizPayload {
  title?: string;
  description?: string;
  duration_seconds?: number;
}

export interface CreateQuestionPayload {
  question: string;
  points: number;
  options: { option_text: string; is_correct: boolean }[];
}

export interface UpdateQuestionPayload {
  question?: string;
  points?: number;
  /** Full options array for edits; keeps stable ids (D-13). */
  options?: {
    id?: string;
    option_text: string;
    is_correct: boolean;
    position?: number;
  }[];
}

export interface ReorderQuestionsPayload {
  question_ids: string[];
}

export interface SaveAnswerPayload {
  selected_option_id: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
