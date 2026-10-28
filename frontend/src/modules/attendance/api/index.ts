/**
 * Attendance API client (weekly Thursday meetings)
 */

import { apiClient, apiGet, apiPost } from "@/lib/api";
import {
  absentUsersSchema,
  attendanceHistorySchema,
  checkInResponseSchema,
  excuseResponseSchema,
  meetingAttendanceSchema,
  meetingScheduleSchema,
  meetingStatisticsSchema,
  monthlyStatisticsSchema,
  myAttendanceSchema,
} from "@/lib/schemas/attendance";
import type {
  AbsentUsersResponse,
  AttendanceHistoryResponse,
  CheckInRequest,
  CheckInResponse,
  ExcuseResponse,
  MeetingAttendanceResponse,
  MeetingScheduleResponse,
  MeetingStatisticsResponse,
  MonthlyStatisticsResponse,
  MyAttendanceResponse,
} from "../types";

// Compatibility re-export: one error-mapping implementation lives in lib/api.
export { getApiErrorMessage } from "@/lib/api";

export const attendanceApi = {
  /** Record attendance for the current meeting via QR code */
  checkIn: async (data: CheckInRequest): Promise<CheckInResponse> => {
    const response = await apiClient.post("/attendance/check-in", data, {
      schema: checkInResponseSchema,
    });
    return response.data;
  },

  /** Get the attendance of one meeting (any date is snapped to its meeting) */
  getMeetingAttendance: async (
    meetingDate?: string,
  ): Promise<MeetingAttendanceResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    return apiGet("/attendance/meeting", meetingAttendanceSchema, { params });
  },

  /** Get the meeting calendar of a month (4 meetings, 5 in long months) */
  getMeetingSchedule: async (
    year?: number,
    month?: number,
  ): Promise<MeetingScheduleResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    return apiGet("/attendance/meetings", meetingScheduleSchema, { params });
  },

  /** Get users who missed a meeting */
  getAbsentUsers: async (
    meetingDate?: string,
    options?: { page?: number; size?: number },
  ): Promise<AbsentUsersResponse> => {
    const params = meetingDate
      ? { meeting_date: meetingDate, ...options }
      : options;
    return apiGet("/attendance/absent", absentUsersSchema, { params });
  },

  /** Get statistics for one meeting */
  getMeetingStatistics: async (
    meetingDate?: string,
  ): Promise<MeetingStatisticsResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    return apiGet("/attendance/statistics/meeting", meetingStatisticsSchema, {
      params,
    });
  },

  /** Get the monthly analysis across the month's meetings */
  getMonthlyStatistics: async (
    year?: number,
    month?: number,
  ): Promise<MonthlyStatisticsResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    return apiGet("/attendance/statistics/monthly", monthlyStatisticsSchema, {
      params,
    });
  },

  /** Get paginated meeting attendance history with filters */
  getAttendanceHistory: async (params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    status?: string;
    page?: number;
    size?: number;
    sort?: "meeting_date" | "check_in_at";
    order?: "asc" | "desc";
  }): Promise<AttendanceHistoryResponse> => {
    return apiGet("/attendance", attendanceHistorySchema, { params });
  },

  /** The calling member's own attendance for one calendar month */
  getMyAttendance: async (
    year?: number,
    month?: number,
  ): Promise<MyAttendanceResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    return apiGet("/attendance/me", myAttendanceSchema, { params });
  },

  /** ADMIN-only correction: mark a record of the open meeting EXCUSED */
  excuseAttendance: async (
    attendanceId: string,
    reason?: string,
  ): Promise<ExcuseResponse> => {
    const response = await apiClient.post(
      `/attendance/${attendanceId}/excuse`,
      {
        reason: reason ?? null,
      },
      { schema: excuseResponseSchema },
    );
    return response.data;
  },
};

/**
 * The member's self-chosen attendance PIN (offline check-in fallback).
 * Lives under /users/me on the wire but belongs to this feature.
 */
export const attendancePinApi = {
  /** Whether the signed-in member currently has a PIN configured */
  getStatus: async (): Promise<{ set: boolean }> => {
    const response = await apiClient.get("/users/me/attendance-pin");
    return response.data;
  },

  /** Create or replace the PIN; 409 conflict when another member holds it */
  set: async (pin: string): Promise<void> => {
    await apiClient.put("/users/me/attendance-pin", { pin });
  },

  /** Remove the PIN; idempotent */
  remove: async (): Promise<void> => {
    await apiClient.delete("/users/me/attendance-pin");
  },
};
