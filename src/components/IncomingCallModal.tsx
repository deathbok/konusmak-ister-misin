'use client';

import { useState, useEffect } from 'react';

interface IncomingCallModalProps {
  isVisible: boolean;
  callerInfo?: {
    roomId: string;
    callerId: string;
    callerRole: string;
  };
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ 
  isVisible, 
  callerInfo, 
  onAccept, 
  onReject 
}: IncomingCallModalProps) {
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsRinging(true);
      
      // Zil sesi efekti (titreşim)
      const interval = setInterval(() => {
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
      }, 1000);

      // 30 saniye sonra otomatik reddet
      const timeout = setTimeout(() => {
        onReject();
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        setIsRinging(false);
      };
    }
  }, [isVisible, onReject]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-pulse">
        
        {/* Arama İkonu */}
        <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
          isRinging ? 'bg-green-500 animate-bounce' : 'bg-green-400'
        }`}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </div>

        {/* Arama Bilgisi */}
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          📞 Gelen Arama
        </h2>
        <p className="text-gray-600 mb-1">
          {callerInfo?.callerRole === 'speaker' ? '🎤 Konuşmacı' : '👂 Dinleyici'} arıyor
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Oda: {callerInfo?.roomId}
        </p>

        {/* Arama Butonları */}
        <div className="flex gap-4 justify-center">
          {/* Reddet */}
          <button
            onClick={onReject}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
            </svg>
          </button>

          {/* Kabul Et */}
          <button
            onClick={onAccept}
            className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors shadow-lg animate-pulse"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </button>
        </div>

        {/* Alt Bilgi */}
        <p className="text-xs text-gray-400 mt-4">
          30 saniye içinde cevaplanmazsa otomatik reddedilir
        </p>
      </div>
    </div>
  );
}
