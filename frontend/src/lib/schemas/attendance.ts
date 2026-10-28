/**
 * The answers of the attendance.
 *
 * The schemas mirror the DTOs of the backend
 * (`app/modules/attendance/application/dto/`): the backend is the source
 * of truth, the schema is the copy that catches a drift.
 *
 * The types of the module are **aliases** of these schemas
 * (`z.infer`), so a shape is written once.
 */

import { z } from "zod";

import { loose } from "./common";

/** The status of a record (the backend sends the value of the enum). */
export const attendanceStatusSchema = z.enum([
  "PRESENT",
  "LATE",
  "ABSENT",
  "EXCUSED",
]);

/** The way the member checked in. */
export const attendanceMethodSchema = z.enum(["QR_SCAN", "MANUAL", "PIN"]);

/** One attendance record (`AttendanceDTO`). */
export const attendanceRecordSchema = loose({
  id: z.string(),
  user_id: z.string(),
  user_name: z.string(),
  meeting_date: z.string(),
  meeting_index_in_month: z.number(),
  check_in_at: z.string(),
  status: attendanceStatusSchema,
  method: attendanceMethodSchema,
  recorded_by: z.string(),
  recorded_by_name: z.string(),
});

/** The roster of one meeting (`MeetingAttendanceResponse`). */
export const meetingAttendanceSchema = loose({
  meeting_date: z.string(),
  meeting_index_in_month: z.number(),
  is_open: z.boolean(),
  total_present: z.number(),
  attendance_records: z.array(attendanceRecordSchema),
});

/** The summary of one meeting (`AttendanceSummary`). */
export const attendanceSummarySchema = loose({
  total_present: z.number(),
  total_late: z.number(),
  total_attended: z.number(),
  excused_count: z.number(),
  total_absent: z.number(),
  total_expected: z.number(),
  attendance_rate: z.number(),
  is_final: z.boolean(),
});

/** The statistics of one meeting (`MeetingStatisticsResponse`). */
export const meetingStatisticsSchema = loose({
  meeting_date: z.string(),
  meeting_index_in_month: z.number(),
  summary: attendanceSummarySchema,
});

/** One meeting of the monthly analysis (`MeetingStat`). */
export const meetingStatSchema = loose({
  meeting_date: z.string(),
  meeting_index_in_month: z.number(),
  present_count: z.number(),
  late_count: z.number(),
  absent_count: z.number(),
  attendance_rate: z.number(),
  is_held: z.boolean(),
});

/** The monthly analysis (`MonthlyStatisticsResponse`). */
export const monthlyStatisticsSchema = loose({
  year: z.number(),
  month: z.number(),
  total_meetings: z.number(),
  meetings_held: z.number(),
  expected_per_meeting: z.number(),
  meetings: z.array(meetingStatSchema),
  total_attendance: z.number(),
  average_attendance: z.number(),
  attendance_rate: z.number(),
  distinct_attendees: z.number(),
  full_attendance_count: z.number(),
  no_attendance_count: z.number(),
});

/** The meeting calendar of a month (`MeetingScheduleResponse`). */
export const meetingScheduleSchema = loose({
  year: z.number(),
  month: z.number(),
  meeting_day: z.string(),
  total_meetings: z.number(),
  meetings: z.array(z.string()),
  open_meeting_date: z.string(),
});

/** One absent member (`AbsentUserDTO`). */
export const absentUserSchema = loose({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

/** The list of the absent members (`AbsentUsersResponse`). */
export const absentUsersSchema = loose({
  meeting_date: z.string(),
  absent_count: z.number(),
  absent_users: z.array(absentUserSchema),
  is_final: z.boolean(),
  page: z.number(),
  size: z.number().nullish(),
});

/** The history of the attendance (`AttendanceHistoryResponse`). */
export const attendanceHistorySchema = loose({
  total_count: z.number(),
  attendance_records: z.array(attendanceRecordSchema),
  page: z.number(),
  size: z.number(),
  pages: z.number(),
  has_next: z.boolean(),
});

/** One of the records of the member himself (`MyAttendanceRecord`). */
export const myAttendanceRecordSchema = loose({
  meeting_date: z.string(),
  meeting_index_in_month: z.number(),
  check_in_at: z.string(),
  status: attendanceStatusSchema,
});

/** The attendance of the member himself (`MyAttendanceResponse`). */
export const myAttendanceSchema = loose({
  year: z.number(),
  month: z.number(),
  total_meetings: z.number(),
  meetings_held: z.number(),
  attended_count: z.number(),
  attendance_rate: z.number(),
  records: z.array(myAttendanceRecordSchema),
});

/** The answer of a check-in (`CheckInResponse`). */
export const checkInResponseSchema = loose({
  success: z.boolean(),
  message: z.string(),
  attendance: attendanceRecordSchema,
});

/** The answer of an excuse (`ExcuseResponse`). */
export const excuseResponseSchema = checkInResponseSchema;
