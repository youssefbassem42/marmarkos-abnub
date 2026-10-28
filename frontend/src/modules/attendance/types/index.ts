/**
 * Attendance module types
 *
 * Attendance is recorded per weekly meeting (Thursday), never per day.
 * A month therefore holds 4 meetings (5 when it has five Thursdays).
 *
 * The answers of the API are described by the **schemas** of
 * `@/lib/schemas/attendance` (they mirror the DTOs of the backend), and
 * the types below are their aliases: a shape is written once, and the
 * schema that checks the answer is the same one that types it.
 */

import type { z } from "zod";

import type {
  absentUserSchema,
  absentUsersSchema,
  attendanceHistorySchema,
  attendanceRecordSchema,
  attendanceStatusSchema,
  attendanceMethodSchema,
  attendanceSummarySchema,
  checkInResponseSchema,
  excuseResponseSchema,
  meetingAttendanceSchema,
  meetingScheduleSchema,
  meetingStatSchema,
  meetingStatisticsSchema,
  monthlyStatisticsSchema,
  myAttendanceRecordSchema,
  myAttendanceSchema,
} from "@/lib/schemas/attendance";

export type AttendanceStatusValue = z.infer<typeof attendanceStatusSchema>;

export type AttendanceMethodValue = z.infer<typeof attendanceMethodSchema>;

export type AttendanceRecord = z.infer<typeof attendanceRecordSchema>;

export interface CheckInRequest {
  /** QR token from camera scan or manual typing */
  qr_code?: string;
  /**
   * The member's self-chosen 5-digit PIN — offline fallback for when
   * they cannot show their QR code at all. Takes precedence server-side;
   * exactly one of qr_code/pin must be sent.
   */
  pin?: string;
  /** Optional; must be the currently open meeting when provided */
  meeting_date?: string;
  /** How the code was captured; defaults to a camera scan */
  method?: AttendanceMethodValue;
}

export type CheckInResponse = z.infer<typeof checkInResponseSchema>;

export type MeetingAttendanceResponse = z.infer<typeof meetingAttendanceSchema>;

export type AbsentUser = z.infer<typeof absentUserSchema>;

export type AbsentUsersResponse = z.infer<typeof absentUsersSchema>;

export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>;

export type MeetingStatisticsResponse = z.infer<typeof meetingStatisticsSchema>;

export type MeetingStat = z.infer<typeof meetingStatSchema>;

export type MonthlyStatisticsResponse = z.infer<typeof monthlyStatisticsSchema>;

export type MeetingScheduleResponse = z.infer<typeof meetingScheduleSchema>;

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

export type AttendanceHistoryResponse = z.infer<typeof attendanceHistorySchema>;

/** Reduced record for member self-service; no admin identity fields. */
export type MyAttendanceRecord = z.infer<typeof myAttendanceRecordSchema>;

export type MyAttendanceResponse = z.infer<typeof myAttendanceSchema>;

export type ExcuseResponse = z.infer<typeof excuseResponseSchema>;
