/**
 * QR Scanner Component for Attendance Check-in
 * Supports RTL/LTR layouts and follows brand design system
 */

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  isProcessing?: boolean;
}

export function QRScanner({ onScan, onError, isProcessing = false }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'qr-reader';

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current && isScanning) {
        stopScanning();
      }
    };
  }, [isScanning]);

  const startScanning = async () => {
    try {
      setError(null);
      
      // Check if already initialized
      if (scannerRef.current) {
        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          handleScanSuccess,
          handleScanFailure
        );
        setIsScanning(true);
        setHasPermission(true);
        return;
      }

      // Initialize scanner
      const scanner = new Html5Qrcode(readerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        handleScanSuccess,
        handleScanFailure
      );

      setIsScanning(true);
      setHasPermission(true);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to start camera';
      setError(errorMessage);
      setHasPermission(false);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    onScan(decodedText);
    // Continue scanning for next user
  };

  const handleScanFailure = () => {
    // Silent fail - normal when no QR code is in view
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Scanner Controls */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#253D63]">
            Scan QR Code
          </h3>
          
          {!isScanning ? (
            <Button
              onClick={startScanning}
              disabled={isProcessing}
              className="bg-[#2672B0] hover:bg-[#253D63]"
            >
              <Camera className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
              Start Scanner
            </Button>
          ) : (
            <Button
              onClick={stopScanning}
              variant="outline"
              className="border-[#9E150B] text-[#9E150B] hover:bg-[#9E150B] hover:text-white"
            >
              <CameraOff className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />
              Stop Scanner
            </Button>
          )}
        </div>

        {/* Scanner Display */}
        <div className="relative">
          <div
            id={readerElementId}
            className="w-full rounded-lg overflow-hidden"
            style={{ minHeight: isScanning ? '300px' : '0' }}
          />

          {!isScanning && hasPermission === null && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Camera className="w-16 h-16 text-[#2672B0] mb-4" />
              <p className="text-[#253D63] font-medium mb-2">
                Ready to Scan
              </p>
              <p className="text-gray-600 text-sm">
                Click "Start Scanner" to begin checking in users
              </p>
            </div>
          )}

          {hasPermission === false && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <XCircle className="w-16 h-16 text-[#9E150B] mb-4" />
              <p className="text-[#9E150B] font-medium mb-2">
                Camera Permission Denied
              </p>
              <p className="text-gray-600 text-sm mb-4">
                Please allow camera access to scan QR codes
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-lg">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2672B0] border-t-transparent mb-4" />
                <p className="text-[#253D63] font-medium">
                  Processing...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-[#9E150B] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-[#9E150B] font-medium">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* Instructions */}
        {isScanning && !isProcessing && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-[#2672B0] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-[#253D63]">
                Point the camera at a user's QR code to record their attendance
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
