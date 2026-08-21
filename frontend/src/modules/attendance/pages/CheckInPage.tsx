/**
 * Attendance Check-In Page
 * For administrators to scan QR codes and record attendance
 */

import { useState } from 'react';
import { CheckCircle2, XCircle, User, Calendar, Clock } from 'lucide-react';
import { QRScanner } from '../components/QRScanner';
import { attendanceApi, getApiErrorMessage } from '../api';
import { Card } from '../../../components/ui/card';
import type { AttendanceRecord } from '../types';

export function CheckInPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState<{
    success: boolean;
    message: string;
    attendance?: AttendanceRecord;
  } | null>(null);

  const handleScan = async (qrCode: string) => {
    setIsProcessing(true);
    setLastScan(null);

    try {
      const response = await attendanceApi.checkIn({ qr_code: qrCode });
      
      setLastScan({
        success: true,
        message: response.message,
        attendance: response.attendance,
      });

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setLastScan(null);
      }, 3000);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to check in user');
      
      setLastScan({
        success: false,
        message,
      });

      // Auto-clear error message after 5 seconds
      setTimeout(() => {
        setLastScan(null);
      }, 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (error: string) => {
    setLastScan({
      success: false,
      message: error,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#253D63] mb-2">
            Attendance Check-In
          </h1>
          <p className="text-gray-600">
            Scan user QR codes to record attendance for this week's Thursday meeting
          </p>
        </div>

        {/* Scanner */}
        <QRScanner
          onScan={handleScan}
          onError={handleError}
          isProcessing={isProcessing}
        />

        {/* Result Display */}
        {lastScan && (
          <Card className={`p-6 ${
            lastScan.success 
              ? 'bg-green-50 border-[#53CB9E]' 
              : 'bg-red-50 border-[#9E150B]'
          }`}>
            <div className="flex items-start gap-4">
              {lastScan.success ? (
                <CheckCircle2 className="w-12 h-12 text-[#53CB9E] flex-shrink-0" />
              ) : (
                <XCircle className="w-12 h-12 text-[#9E150B] flex-shrink-0" />
              )}

              <div className="flex-1">
                <p className={`text-lg font-semibold mb-2 ${
                  lastScan.success ? 'text-[#253D63]' : 'text-[#9E150B]'
                }`}>
                  {lastScan.success ? '✓ Attendance Recorded' : '✗ Check-In Failed'}
                </p>

                <p className="text-gray-700 mb-4">
                  {lastScan.message}
                </p>

                {lastScan.attendance && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-[#2672B0]" />
                      <span className="font-medium text-[#253D63]">
                        {lastScan.attendance.user_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#2672B0]" />
                      <span className="text-gray-600">
                        {new Date(lastScan.attendance.meeting_date).toLocaleDateString()}
                        {' · '}
                        Meeting {lastScan.attendance.meeting_index_in_month} of the month
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#2672B0]" />
                      <span className="text-gray-600">
                        {new Date(lastScan.attendance.check_in_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#53CB9E]/20">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#53CB9E] text-white">
                        {lastScan.attendance.status}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-6 bg-blue-50">
          <h3 className="text-lg font-semibold text-[#253D63] mb-3">
            How to Use
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-[#2672B0]">1.</span>
              <span>Click "Start Scanner" to activate the camera</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2672B0]">2.</span>
              <span>Point the camera at the user's QR code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2672B0]">3.</span>
              <span>
                Attendance is recorded for this week's Thursday meeting, and a member can
                only be recorded once per meeting
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#2672B0]">4.</span>
              <span>Continue scanning to check in more users</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
