/**
 * The answers of the quizzes, as the backend sends them.
 *
 * The fixtures are **complete**: they carry every field the DTO of the
 * backend declares, so an endpoint with a schema accepts them.
 */

export const QUIZ_ADMIN_ITEM = {
  id: "quiz-1",
  title: "اختبار الآية",
  verse_id: "verse-1",
  verse_reference: "١ يوئيل ٣:١",
  total_points: 10,
  duration_seconds: 600,
  question_count: 1,
  status: "DRAFT",
  published_at: null,
  created_at: "2026-10-01T00:00:00Z",
};

export const QUIZ_DETAIL = {
  ...QUIZ_ADMIN_ITEM,
  description: "اختبار على آية اليوم",
  questions: [
    {
      id: "q1",
      question: "ما هو الكتاب؟",
      points: 10,
      position: 1,
      options: [
        { id: "o1", option_text: "إنجيل متى", is_correct: true, position: 1 },
        { id: "o2", option_text: "إنجيل لوقا", is_correct: false, position: 2 },
      ],
    },
  ],
};

export const QUIZ_VALIDATION = {
  is_publishable: false,
  rules: [
    { code: "has_questions", passed: true, detail: "يوجد سؤال واحد" },
    {
      code: "has_correct_answer",
      passed: false,
      detail: "سؤال بلا إجابة صحيحة",
    },
  ],
};

export const QUIZ_TAKE = {
  id: "quiz-1",
  title: "اختبار الآية",
  description: "اختبار على آية اليوم",
  duration_seconds: 600,
  total_points: 10,
  question_count: 1,
  attempt_id: null,
  questions: [
    {
      id: "q1",
      question: "ما هو الكتاب؟",
      points: 10,
      position: 1,
      answered: false,
      selected_option_id: null,
      options: [
        { id: "o1", option_text: "إنجيل متى", position: 1 },
        { id: "o2", option_text: "إنجيل لوقا", position: 2 },
      ],
    },
  ],
};

export const ATTEMPT_START = {
  id: "attempt-1",
  quiz_id: "quiz-1",
  started_at: "2026-10-22T19:00:00Z",
  remaining_seconds: 600,
  server_time: "2026-10-22T19:00:00Z",
  duration_seconds: 600,
  total_points: 10,
  question_count: 1,
  questions: QUIZ_TAKE.questions,
};

export const ATTEMPT_RESUME = {
  ...ATTEMPT_START,
  status: "IN_PROGRESS",
};

export const ATTEMPT_HEARTBEAT = {
  attempt_id: "attempt-1",
  status: "IN_PROGRESS",
  remaining_seconds: 580,
  server_time: "2026-10-22T19:00:20Z",
};

export const ATTEMPT_RESULT = {
  attempt_id: "attempt-1",
  quiz_id: "quiz-1",
  verse_id: "verse-1",
  status: "COMPLETED",
  score: 10,
  total_points: 10,
  percentage: 100,
  correct_count: 1,
  incorrect_count: 0,
  question_count: 1,
  points_awarded: 10,
  finished_at: "2026-10-22T19:05:00Z",
  time_taken_seconds: 300,
  score_out_of_10: 10,
  points: {
    week_before: 20,
    week_after: 30,
    month_before: 60,
    month_after: 70,
    lifetime_before: 200,
    lifetime_after: 210,
  },
  review: [
    {
      question_id: "q1",
      position: 1,
      question: "ما هو الكتاب؟",
      points: 10,
      selected_option_id: "o1",
      correct_option_id: "o1",
      is_correct: true,
      points_awarded: 10,
      options: [
        { id: "o1", option_text: "إنجيل متى", position: 1, is_correct: true },
        { id: "o2", option_text: "إنجيل لوقا", position: 2, is_correct: false },
      ],
    },
  ],
};

export const ATTEMPT_REVIEW = {
  attempt_id: "attempt-1",
  quiz_id: "quiz-1",
  verse_id: "verse-1",
  status: "COMPLETED",
  score: 10,
  total_points: 10,
  score_out_of_10: 10,
  percentage: 100,
  correct_count: 1,
  incorrect_count: 0,
  question_count: 1,
  points_awarded: 10,
  finished_at: "2026-10-22T19:05:00Z",
  time_taken_seconds: 300,
  user: {
    user_id: "user-1",
    full_name: "العضو",
    email: "member@example.com",
    avatar: null,
  },
  review: [
    {
      question_id: "q1",
      position: 1,
      question: "ما هو الكتاب؟",
      points: 10,
      selected_option_id: "o1",
      correct_option_id: "o1",
      is_correct: true,
      points_awarded: 10,
      options: [
        { id: "o1", option_text: "إنجيل متى", position: 1, is_correct: true },
        { id: "o2", option_text: "إنجيل لوقا", position: 2, is_correct: false },
      ],
    },
  ],
};

export const QUIZ_ANALYTICS_OVERVIEW = {
  total_quizzes: 12,
  published_quizzes: 10,
  participants: 40,
  completed: 35,
  auto_finished: 2,
  average_score: 72.5,
};

export const QUIZ_ANALYTICS = {
  participants: 8,
  completed: 5,
  auto_finished: 3,
  average_score_out_of_10: 7.5,
  highest_score: 10,
  lowest_score: 4,
  total_points_awarded: 60,
  max_possible_points: 10,
  score_distribution: [
    { score: 10, users: 2 },
    { score: 9, users: 1 },
    { score: 8, users: 1 },
    { score: 7, users: 1 },
    { score: 4, users: 1 },
    { score: 3, users: 0 },
    { score: 2, users: 0 },
    { score: 1, users: 0 },
    { score: 0, users: 0 },
  ],
  completion_status: [
    { status: "COMPLETED", users: 5, percentage: 62.5 },
    { status: "AUTO_FINISHED", users: 3, percentage: 37.5 },
  ],
};

export const QUIZ_ANALYTICS_USERS = {
  items: [
    {
      user_id: "user-1",
      full_name: "أحمد محمد",
      email: "ahmed@example.com",
      avatar: null,
      score: 10,
      total_points: 10,
      percentage: 100,
      points_awarded: 10,
      status: "COMPLETED",
      finished_at: "2026-10-22T19:05:00Z",
      time_taken_seconds: 300,
    },
    {
      user_id: "user-2",
      full_name: "فاطمة علي",
      email: "fatma@example.com",
      avatar: null,
      score: 4,
      total_points: 10,
      percentage: 40,
      points_awarded: 0,
      status: "AUTO_FINISHED",
      finished_at: "2026-10-22T19:10:00Z",
      time_taken_seconds: 600,
    },
  ],
  total: 2,
  page: 1,
  size: 20,
  pages: 1,
  has_next: false,
};
