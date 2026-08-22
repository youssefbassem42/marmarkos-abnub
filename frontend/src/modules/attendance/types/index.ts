/**
 * Attendance module types
 *
 * Attendance is recorded per weekly meeting (Thursday), never per day.
 * A month therefore holds 4 meetings (5 when it has five Thursdays).
 */

export type AttendanceStatusValue = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

export type AttendanceMethodValue = "QR_SCAN" | "MANUAL";

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_name: string;
  /** ISO date of the Thursday meeting the record belongs to */
  meeting_date: string;
  /** 1-based position of the meeting within its month (1..5) */
  meeting_index_in_month: number;
  check_in_at: string;
  status: AttendanceStatusValue;
  method: AttendanceMethodValue;
  recorded_by: string;
  recorded_by_name: string;
}

export interface CheckInRequest {
  qr_code: string;
  /** Optional; must be the currently open meeting when provided */
  meeting_date?: string;
  /** How the code was captured; defaults to a camera scan */
  method?: AttendanceMethodValue;
}

export interface CheckInResponse {
  success: boolean;
  message: string;
  attendance: AttendanceRecord;
}

export interface MeetingAttendanceResponse {
  meeting_date: string;
  meeting_index_in_month: number;
  /** True when this meeting is the one currently open for check-in */
  is_open: boolean;
  total_present: number;
  attendance_records: AttendanceRecord[];
}

export interface AbsentUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface AbsentUsersResponse {
  meeting_date: string;
  absent_count: number;
  absent_users: AbsentUser[];
  /** False before the absence cutoff: the list is provisional (BR-5) */
  is_final: boolean;
}

export interface AttendanceSummary {
  total_present: number;
  total_late: number;
  /** PRESENT + LATE: late members count as attended (BR-3) */
  total_attended: number;
  excused_count: number;
  total_absent: number;
  total_expected: number;
  attendance_rate: number;
  /** True once the absence cutoff has passed (BR-5) */
  is_final: boolean;
}

export interface MeetingStatisticsResponse {
  meeting_date: string;
  meeting_index_in_month: number;
  summary: AttendanceSummary;
}

export interface MeetingStat {
  meeting_date: string;
  meeting_index_in_month: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_rate: number;
  /** False for meetings still in the future */
  is_held: boolean;
}

export interface MonthlyStatisticsResponse {
  year: number;
  month: number;
  /** Meetings scheduled in the month (4 or 5) */
  total_meetings: number;
  meetings_held: number;
  expected_per_meeting: number;
  meetings: MeetingStat[];
  total_attendance: number;
  average_attendance: number;
  attendance_rate: number;
  distinct_attendees: number;
  full_attendance_count: number;
  no_attendance_count: number;
}

export interface MeetingScheduleResponse {
  year: number;
  month: number;
  meeting_day: string;
  total_meetings: number;
  meetings: string[];
  open_meeting_date: string;
}

export interface AttendanceHistoryFilters {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  status?: AttendanceStatusValue | "";
  page?: number;
  size?: number;
  sort?: "meeting_date" | "check_in_at";
  order?: "asc" | "desc";
}

export interface AttendanceHistoryResponse {
  total_count: number;
  attendance_records: AttendanceRecord[];
  page: number;
  size: number;
  pages: number;
  has_next: boolean;
}

/** Reduced record for member self-service; no admin identity fields. */
export interface MyAttendanceRecord {
  meeting_date: string;
  meeting_index_in_month: number;
  check_in_at: string;
  status: AttendanceStatusValue;
}

export interface MyAttendanceResponse {
  year: number;
  month: number;
  total_meetings: number;
  meetings_held: number;
  attended_count: number;
  attendance_rate: number;
  records: MyAttendanceRecord[];
}

export interface ExcuseResponse {
  success: boolean;
  message: string;
  attendance: AttendanceRecord;
}
