/**
 * Attendance API client (weekly Thursday meetings)
 */

import { apiClient } from "@/lib/api";
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
    const response = await apiClient.post("/attendance/check-in", data);
    return response.data;
  },

  /** Get the attendance of one meeting (any date is snapped to its meeting) */
  getMeetingAttendance: async (
    meetingDate?: string,
  ): Promise<MeetingAttendanceResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get("/attendance/meeting", { params });
    return response.data;
  },

  /** Get the meeting calendar of a month (4 meetings, 5 in long months) */
  getMeetingSchedule: async (
    year?: number,
    month?: number,
  ): Promise<MeetingScheduleResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get("/attendance/meetings", { params });
    return response.data;
  },

  /** Get users who missed a meeting */
  getAbsentUsers: async (
    meetingDate?: string,
  ): Promise<AbsentUsersResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get("/attendance/absent", { params });
    return response.data;
  },

  /** Get statistics for one meeting */
  getMeetingStatistics: async (
    meetingDate?: string,
  ): Promise<MeetingStatisticsResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get("/attendance/statistics/meeting", {
      params,
    });
    return response.data;
  },

  /** Get the monthly analysis across the month's meetings */
  getMonthlyStatistics: async (
    year?: number,
    month?: number,
  ): Promise<MonthlyStatisticsResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get("/attendance/statistics/monthly", {
      params,
    });
    return response.data;
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
    const response = await apiClient.get("/attendance", { params });
    return response.data;
  },

  /** The calling member's own attendance for one calendar month */
  getMyAttendance: async (
    year?: number,
    month?: number,
  ): Promise<MyAttendanceResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get("/attendance/me", { params });
    return response.data;
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
    );
    return response.data;
  },
};
