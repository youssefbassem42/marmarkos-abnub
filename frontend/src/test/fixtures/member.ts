/**
 * The answers of the members, of the notifications and of the points.
 *
 * The fixtures are **complete**: they carry every field the DTO of the
 * backend declares, so an endpoint with a schema accepts them.
 */

export const MEMBER = {
  id: "user-1",
  email: "member@example.com",
  phone: "+201000000000",
  first_name: "العضو",
  last_name: "الاختبار",
  date_of_birth: "1995-05-10",
  address: "القاهرة",
  avatar: null,
  role: "MEMBER",
  status: "ACTIVE",
  public_id: "MMBR-0001",
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: "2026-10-20T10:00:00Z",
  has_password: true,
  email_verified: true,
};

export const NOTIFICATION = {
  id: "notification-1",
  type: "ANNOUNCEMENT",
  title_ar: "إعلان",
  title_en: "Announcement",
  message_ar: "رسالة الإعلان",
  message_en: "The announcement message",
  data: null,
  is_read: false,
  is_broadcast: true,
  created_at: "2026-10-20T10:00:00Z",
};

export const NOTIFICATION_SUMMARY = {
  unread_count: 3,
  tab_counts: {
    all: 10,
    unread: 3,
    announcements: 4,
    reminders: 3,
    system: 3,
  },
};

export const MARK_READ = { marked: 2 };

export const POINTS = {
  lifetime: 500,
  this_week: 40,
  this_month: 120,
  quizzes_completed: 12,
};

export const MONTHLY_POINTS = {
  items: [
    {
      period_month: "2026-08-01",
      points: 80,
      quizzes_completed: 3,
    },
    {
      period_month: "2026-09-01",
      points: 140,
      quizzes_completed: 5,
    },
    {
      period_month: "2026-10-01",
      points: 120,
      quizzes_completed: 4,
    },
  ],
};

export const POINT_ACTIVITY = {
  id: "transaction-1",
  points: 10,
  awarded_at: "2026-10-20T10:00:00Z",
  quiz_id: "quiz-1",
  quiz_title: "اختبار الآية",
  verse_id: "verse-1",
  verse_reference: "١ يوئيل ٣:١",
  source: "QUIZ_COMPLETION",
};
