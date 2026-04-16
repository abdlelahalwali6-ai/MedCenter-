/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Card } from '@/components/ui/card';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  title?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, title = "مسح الباركود" }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE
        ]
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => {
        onScan(decodedText);
        // We don't close automatically to allow multiple scans if needed by the parent
      },
      (errorMessage) => {
        // console.error(errorMessage);
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, []);

  return (
    <Card className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden rounded-none border-none">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Camera size={20} />
            </div>
            <h3 className="font-bold text-lg">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>
        
        <div className="p-6">
          <div id="reader" className="overflow-hidden rounded-xl border-2 border-primary/20 bg-slate-100"></div>
          <p className="mt-4 text-center text-sm text-slate-500 font-medium">
            قم بتوجيه الكاميرا نحو الرمز (الباركود) للمسح التلقائي
          </p>
        </div>
        
        <div className="p-4 bg-slate-50 border-t flex justify-center">
          <Button variant="outline" onClick={onClose} className="w-full max-w-xs">إغلاق الكاميرا</Button>
        </div>
      </div>
    </Card>
  );
};
