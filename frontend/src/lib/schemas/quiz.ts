/**
 * The answers of the quizzes.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/quiz/application/dto/`).
 *
 * The member path (`/quizzes/{id}/take`) never carries the correctness
 * of the options: the schema of the take payload has **no** `is_correct`
 * field, so an answer that starts to leak it is caught.
 */

import { z } from "zod";

import { loose } from "./common";

/** The status of a quiz. */
export const quizStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

/** The status of an attempt. */
export const attemptStatusSchema = z.enum([
  "IN_PROGRESS",
  "COMPLETED",
  "AUTO_FINISHED",
  "EXPIRED",
]);

/** One option of a question (the manager side, with the correctness). */
export const questionOptionSchema = loose({
  id: z.string(),
  option_text: z.string(),
  is_correct: z.boolean(),
  position: z.number(),
});

/** One question of a quiz (the manager side). */
export const questionSchema = loose({
  id: z.string(),
  question: z.string(),
  points: z.number(),
  position: z.number(),
  options: z.array(questionOptionSchema),
});

/** A quiz of the list (the manager side). */
export const quizAdminItemSchema = loose({
  id: z.string(),
  title: z.string(),
  verse_id: z.string(),
  verse_reference: z.string(),
  total_points: z.number(),
  duration_seconds: z.number(),
  question_count: z.number(),
  status: quizStatusSchema,
  published_at: z.string().nullable(),
  created_at: z.string(),
});

/** A quiz with its questions (the manager side). */
export const quizDetailSchema = quizAdminItemSchema.extend({
  description: z.string().nullable(),
  questions: z.array(questionSchema),
});

/** One rule of the readiness of a quiz. */
export const quizValidationRuleSchema = loose({
  code: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

/** The readiness of a quiz. */
export const quizValidationSchema = loose({
  is_publishable: z.boolean(),
  rules: z.array(quizValidationRuleSchema),
});

/** One option of the take payload - **without** the correctness. */
export const takeOptionSchema = loose({
  id: z.string(),
  option_text: z.string(),
  position: z.number(),
});

/** One question of the take payload - **without** the correctness. */
export const takeQuestionSchema = loose({
  id: z.string(),
  question: z.string(),
  points: z.number(),
  position: z.number(),
  answered: z.boolean(),
  selected_option_id: z.string().nullable(),
  options: z.array(takeOptionSchema),
});

/** The payload of the member path (`GET /quizzes/{id}/take`). */
/**
 * The payload of the member path (`GET /quizzes/{id}/take`).
 *
 * The fields are exactly the ones of `QuizTakeResponse` of the backend:
 * no `verse_id`, no `verse_reference` and no `status` — the page must
 * not wait for fields the server does not send (the schema rejected
 * the answer and the page showed its error state).
 */
export const quizTakeSchema = loose({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  duration_seconds: z.number(),
  total_points: z.number(),
  question_count: z.number(),
  attempt_id: z.string().nullable(),
  questions: z.array(takeQuestionSchema),
});

/** The start of an attempt (`AttemptStartResponse`). */
export const attemptStartSchema = loose({
  id: z.string(),
  quiz_id: z.string(),
  started_at: z.string(),
  remaining_seconds: z.number(),
  server_time: z.string(),
  duration_seconds: z.number(),
  total_points: z.number(),
  question_count: z.number(),
  questions: z.array(takeQuestionSchema),
});

/** The resume of an attempt (`AttemptResumeResponse`). */
export const attemptResumeSchema = attemptStartSchema.extend({
  status: attemptStatusSchema,
});

/** The answer of the heartbeat (`AttemptHeartbeatResponse`). */
export const attemptHeartbeatSchema = loose({
  attempt_id: z.string(),
  status: attemptStatusSchema,
  remaining_seconds: z.number(),
  server_time: z.string(),
});

/** One option of the review - **with** the correctness. */
export const gradedOptionSchema = loose({
  id: z.string(),
  option_text: z.string(),
  position: z.number(),
  is_correct: z.boolean(),
});

/** One question of the review. */
export const reviewQuestionSchema = loose({
  question_id: z.string(),
  position: z.number(),
  question: z.string(),
  points: z.number(),
  selected_option_id: z.string().nullable(),
  correct_option_id: z.string().nullable(),
  is_correct: z.boolean(),
  points_awarded: z.number(),
  options: z.array(gradedOptionSchema),
});

/** The points before and after the attempt (`PointsSnapshot`). */
export const pointsSnapshotSchema = loose({
  week_before: z.number(),
  week_after: z.number(),
  month_before: z.number(),
  month_after: z.number(),
  lifetime_before: z.number(),
  lifetime_after: z.number(),
});

/**
 * The result of an attempt (`AttemptResultResponse`).
 *
 * The answer carries the **review** of the attempt (`review`, not
 * `questions`): the question by question with the correctness — the
 * owner of the attempt may read it (the DTO of the backend says
 * "owner only"). The page of the result used to read `questions`, a
 * field the server never sent: the review was **always empty**.
 */
export const attemptResultSchema = loose({
  attempt_id: z.string(),
  quiz_id: z.string(),
  verse_id: z.string().nullable(),
  status: attemptStatusSchema,
  score: z.number(),
  total_points: z.number(),
  score_out_of_10: z.number(),
  percentage: z.number(),
  correct_count: z.number(),
  incorrect_count: z.number(),
  question_count: z.number(),
  points_awarded: z.number(),
  finished_at: z.string(),
  time_taken_seconds: z.number(),
  points: pointsSnapshotSchema,
  review: z.array(reviewQuestionSchema),
});

/** The block of the member in the review of the manager. */
export const attemptUserBlockSchema = loose({
  user_id: z.string(),
  full_name: z.string(),
  email: z.string(),
  avatar: z.string().nullable(),
});

/** The review of an attempt (`ManagerAttemptReviewResponse`). */
export const attemptReviewSchema = loose({
  attempt_id: z.string(),
  quiz_id: z.string(),
  verse_id: z.string().nullable(),
  status: attemptStatusSchema,
  score: z.number(),
  total_points: z.number(),
  score_out_of_10: z.number(),
  percentage: z.number(),
  correct_count: z.number(),
  incorrect_count: z.number(),
  question_count: z.number(),
  points_awarded: z.number(),
  finished_at: z.string(),
  time_taken_seconds: z.number(),
  user: attemptUserBlockSchema,
  review: z.array(reviewQuestionSchema),
});

/** The summary of the quizzes (the tiles of the dashboard). */
export const quizAnalyticsOverviewSchema = loose({
  total_quizzes: z.number(),
  published_quizzes: z.number(),
  participants: z.number(),
  completed: z.number(),
  average_score: z.number(),
});
