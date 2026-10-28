/**
 * The answers of the verses, as the backend sends them.
 *
 * The fixtures are **complete**: they carry every field the DTO of the
 * backend declares, so an endpoint with a schema accepts them.
 */

export const VERSE_ADMIN_ITEM = {
  id: "verse-1",
  title: "آية الاختبار",
  subtitle: "عنوان فرعي",
  verse_reference: "١ يوئيل ٣:١",
  book: "يوئيل",
  chapter: 3,
  verse_start: 1,
  verse_end: 2,
  status: "PUBLISHED",
  schedule: null,
  has_quiz: true,
  opens: 12,
  reads: 8,
  created_by_user: {
    id: "user-1",
    full_name: "الخادم",
    email: "servant@example.com",
  },
  created_at: "2026-10-01T00:00:00Z",
  published_at: "2026-10-20T08:00:00Z",
};

export const VERSE_DETAIL = {
  ...VERSE_ADMIN_ITEM,
  subtitle: "عنوان فرعي",
  book: "يوئيل",
  chapter: 3,
  verse_start: 1,
  verse_end: 2,
  text: "نص الآية",
  reflection: "تأمل في الآية",
  image: "/images/verse.webp",
  translation: "van Dyck",
  week_start_date: "2026-10-19",
  is_read: false,
  quiz_summary: {
    quiz_id: "quiz-1",
    status: "PUBLISHED",
    question_count: 2,
    total_points: 10,
    duration_seconds: 600,
  },
};

export const VERSE_CARD = {
  id: "verse-1",
  title: "آية الاختبار",
  verse_reference: "١ يوئيل ٣:١",
  excerpt: "نص الآية مختصرا",
  image: "/images/verse.webp",
  published_at: "2026-10-20T08:00:00Z",
  week_start_date: "2026-10-19",
  is_read: false,
  has_quiz: true,
  quiz_state: null,
};

export const VERSE_STATS = {
  total: 12,
  drafts: 2,
  scheduled: 1,
  published: 8,
  archived: 1,
};

export const VERSE_ANALYTICS_OVERVIEW = {
  total_posts: 12,
  published: 8,
  total_opens: 120,
  total_reads: 90,
  read_rate: 75,
};

export const VERSE_QUICK_STATS = {
  this_week: 20,
  this_month: 80,
  avg_reads: 2.5,
  top_verse_reference: "١ يوئيل ٣:١",
  top_verse_opens: 30,
};

export const VERSE_ANALYTICS = {
  verse_id: "verse-1",
  title: "آية الاختبار",
  verse_reference: "١ يوئيل ٣:١",
  total_opens: 30,
  unique_opens: 20,
  total_reads: 15,
  unique_readers: 12,
  read_rate: 60,
  series: [{ bucket: "2026-10-19", opens: 10, reads: 5 }],
  quiz: { quiz_id: "quiz-1", participants: 8, average_score_out_of_10: 7.5 },
};

export const VERSE_USER_ENGAGEMENT = {
  user_id: "user-1",
  full_name: "العضو",
  avatar: null,
  opened_count: 3,
  has_read: true,
  last_opened_at: "2026-10-21T10:00:00Z",
};

export const VERSE_SCHEDULE = {
  id: "schedule-1",
  verse_id: "verse-1",
  status: "SCHEDULED",
  scheduled_at: "2026-10-27T08:00:00Z",
  created_by_user_id: "user-1",
  verse_reference: "١ يوئيل ٣:١",
  verse_title: "آية الاختبار",
  attempts: 0,
  notification_status: "PENDING",
};
