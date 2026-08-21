/**
 * Attendance API client (weekly Thursday meetings)
 */

import { apiClient } from '../../../lib/api';
import type {
  AbsentUsersResponse,
  AttendanceHistoryResponse,
  CheckInRequest,
  CheckInResponse,
  MeetingAttendanceResponse,
  MeetingScheduleResponse,
  MeetingStatisticsResponse,
  MonthlyStatisticsResponse,
} from '../types';

/**
 * Extract a displayable message from an API error.
 *
 * The backend returns `{ detail: { code, message } }` for handled errors and
 * `{ detail: [{ msg }] }` for FastAPI validation errors, so `detail` must
 * never be rendered directly.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === 'string') {
      return first.msg;
    }
  }

  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export const attendanceApi = {
  /**
   * Record attendance for the current meeting via QR code
   */
  checkIn: async (data: CheckInRequest): Promise<CheckInResponse> => {
    const response = await apiClient.post('/attendance/check-in', data);
    return response.data;
  },

  /**
   * Get the attendance of one meeting (any date is snapped to its meeting)
   */
  getMeetingAttendance: async (meetingDate?: string): Promise<MeetingAttendanceResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/meeting', { params });
    return response.data;
  },

  /**
   * Get the meeting calendar of a month (4 meetings, 5 in long months)
   */
  getMeetingSchedule: async (year?: number, month?: number): Promise<MeetingScheduleResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get('/attendance/meetings', { params });
    return response.data;
  },

  /**
   * Get users who missed a meeting
   */
  getAbsentUsers: async (meetingDate?: string): Promise<AbsentUsersResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/absent', { params });
    return response.data;
  },

  /**
   * Get statistics for one meeting
   */
  getMeetingStatistics: async (meetingDate?: string): Promise<MeetingStatisticsResponse> => {
    const params = meetingDate ? { meeting_date: meetingDate } : {};
    const response = await apiClient.get('/attendance/statistics/meeting', { params });
    return response.data;
  },

  /**
   * Get the monthly analysis across the month's meetings
   */
  getMonthlyStatistics: async (year?: number, month?: number): Promise<MonthlyStatisticsResponse> => {
    const params = { ...(year ? { year } : {}), ...(month ? { month } : {}) };
    const response = await apiClient.get('/attendance/statistics/monthly', { params });
    return response.data;
  },

  /**
   * Get meeting attendance history with filters
   */
  getAttendanceHistory: async (params?: {
    start_date?: string;
    end_date?: string;
    user_id?: string;
    status?: string;
  }): Promise<AttendanceHistoryResponse> => {
    const response = await apiClient.get('/attendance', { params });
    return response.data;
  },
};
