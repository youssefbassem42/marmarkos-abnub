/**
 * The answers of the attendance, as the backend sends them.
 *
 * The fixtures are **complete**: they carry every field the DTO of the
 * backend declares. An endpoint with a schema rejects an incomplete
 * answer, so a fixture that drifts is a test that fails - and the
 * drift is visible in the failure, not in a white screen.
 */

export const ATTENDANCE_RECORD = {
  id: "a1",
  user_id: "u1",
  user_name: "محمود",
  meeting_date: "2026-10-22",
  meeting_index_in_month: 3,
  check_in_at: "2026-10-22T19:03:00Z",
  status: "PRESENT",
  method: "PIN",
  recorded_by: "admin-1",
  recorded_by_name: "الخادم",
};

export const CHECK_IN_RESPONSE = {
  success: true,
  message: "تم تسجيل الحضور",
  attendance: ATTENDANCE_RECORD,
};

export const MEETING_ATTENDANCE = {
  meeting_date: "2026-10-22",
  meeting_index_in_month: 3,
  is_open: true,
  total_present: 30,
  attendance_records: [ATTENDANCE_RECORD],
};

export const MEETING_STATISTICS = {
  meeting_date: "2026-10-22",
  meeting_index_in_month: 3,
  summary: {
    total_present: 30,
    total_late: 4,
    total_attended: 34,
    excused_count: 1,
    total_absent: 5,
    total_expected: 40,
    attendance_rate: 85,
    is_final: false,
  },
};

export const MEETING_SCHEDULE = {
  year: 2026,
  month: 10,
  meeting_day: "الخميس",
  total_meetings: 5,
  meetings: [
    "2026-10-01",
    "2026-10-08",
    "2026-10-15",
    "2026-10-22",
    "2026-10-29",
  ],
  open_meeting_date: "2026-10-22",
};

export const ABSENT_USERS = {
  meeting_date: "2026-10-22",
  absent_count: 2,
  absent_users: [
    { user_id: "u2", name: "مينا", email: "mina@example.com", role: "MEMBER" },
  ],
  is_final: false,
  page: 1,
  size: 10,
};

export const ATTENDANCE_HISTORY = {
  total_count: 1,
  attendance_records: [ATTENDANCE_RECORD],
  page: 1,
  size: 100,
  pages: 1,
  has_next: false,
};

export const MY_ATTENDANCE = {
  year: 2026,
  month: 10,
  total_meetings: 4,
  meetings_held: 3,
  attended_count: 2,
  attendance_rate: 67,
  records: [
    {
      meeting_date: "2026-10-15",
      meeting_index_in_month: 3,
      check_in_at: "2026-10-15T19:01:00Z",
      status: "PRESENT",
    },
  ],
};

export const MONTHLY_STATISTICS = {
  year: 2026,
  month: 10,
  total_meetings: 5,
  meetings_held: 4,
  expected_per_meeting: 40,
  meetings: [
    {
      meeting_date: "2026-10-01",
      meeting_index_in_month: 1,
      present_count: 30,
      late_count: 4,
      absent_count: 6,
      attendance_rate: 85,
      is_held: true,
    },
  ],
  total_attendance: 120,
  average_attendance: 30,
  attendance_rate: 75,
  distinct_attendees: 35,
  full_attendance_count: 12,
  no_attendance_count: 3,
};
