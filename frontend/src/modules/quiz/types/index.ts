/**
 * Quiz module types
 *
 * Manages quizzes tied to Bible verses: questions, options,
 * and member quiz attempts with grading.
 */

export type QuizStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AttemptStatus = "IN_PROGRESS" | "COMPLETED" | "AUTO_FINISHED";

export interface QuizAdminItem {
  id: string;
  title: string;
  verse_reference: string;
  verse_id: string;
  total_points: number;
  duration_seconds: number;
  question_count: number;
  status: QuizStatus;
  published_at: string | null;
  created_at: string;
}

export interface QuizOptionResponse {
  id: string;
  option_text: string;
  is_correct: boolean;
  position: number;
}

export interface QuizQuestionResponse {
  id: string;
  question: string;
  points: number;
  position: number;
  options: QuizOptionResponse[];
}

export interface QuizDetailResponse extends QuizAdminItem {
  description: string;
  questions: QuizQuestionResponse[];
}

export interface QuizValidationResponse {
  ready: boolean;
  issues: string[];
}

// --- Member-facing quiz take types (no is_correct) ---

export interface QuizTakeOption {
  id: string;
  option_text: string;
  position: number;
}

export interface QuizTakeQuestion {
  id: string;
  question: string;
  points: number;
  position: number;
  options: QuizTakeOption[];
}

export interface QuizTakeResponse {
  id: string;
  title: string;
  description: string;
  duration_seconds: number;
  total_points: number;
  question_count: number;
  questions: QuizTakeQuestion[];
}

// --- Attempt types ---

export interface AttemptQuestionBrief {
  id: string;
  question: string;
  position: number;
  points: number;
  answered: boolean;
  selected_option_id: string | null;
}

export interface AttemptStartResponse {
  id: string;
  quiz_id: string;
  started_at: string;
  expires_at: string;
  remaining_seconds: number;
  server_time: string;
  question_count: number;
  questions: AttemptQuestionBrief[];
}

export interface AttemptStatusResponse {
  id: string;
  quiz_id: string;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  remaining_seconds: number;
  server_time: string;
  score: number | null;
  question_count: number;
  answered_count: number;
}

export interface GradedOption {
  id: string;
  option_text: string;
  position: number;
  is_correct: boolean;
}

export interface GradedQuestion {
  id: string;
  question: string;
  points: number;
  position: number;
  is_correct: boolean;
  points_awarded: number;
  selected_option_id: string;
  correct_option_id: string;
  options: GradedOption[];
}

export interface AttemptResultResponse {
  id: string;
  status: AttemptStatus;
  score: number;
  total_points: number;
  correct_count: number;
  incorrect_count: number;
  duration_seconds: number;
  questions: GradedQuestion[];
}

export type AttemptReviewResponse = AttemptResultResponse;

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
