'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, set } from 'firebase/database';
import { startCall, listenForCall } from '@/lib/webrtc-simple';
import IncomingCallModal from '@/components/IncomingCallModal';
import { useIncomingCall } from '@/hooks/useIncomingCall';

function SmartCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId') || `room_${Date.now()}`;
  const userRole = searchParams.get('role') as 'speaker' | 'listener';
  const userId = searchParams.get('userId') || `user_${Date.now()}`;

  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Incoming call detection
  const { incomingCall, clearIncomingCall } = useIncomingCall(userId, userRole);

  // Start outgoing call
  const handleStartCall = async () => {
    if (!roomId) return;
    
    setIsCallConnecting(true);
    
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      // Setup audio elements
      const localAudio = document.getElementById('local-audio') as HTMLAudioElement;
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      
      if (localAudio) {
        localAudio.srcObject = stream;
        localAudio.play().catch(e => console.log('Local audio play failed:', e));
      }

      if (!remoteAudio) {
        throw new Error('Remote audio element not found');
      }

      // Create call info in Firebase
      const callRef = ref(db, `calls/${roomId}`);
      await set(callRef, {
        callerId: userId,
        callerRole: userRole,
        targetRole: userRole === 'speaker' ? 'listener' : 'speaker',
        timestamp: Date.now(),
        status: 'calling'
      });

      // Start WebRTC call
      const pc = await startCall(roomId, stream, remoteAudio);
      setPeerConnection(pc);
      
      // Listen for connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsCallConnecting(false);
          setIsCallActive(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          endCall();
        }
      };

    } catch (error) {
      console.error('Error starting call:', error);
      setIsCallConnecting(false);
      alert('Arama başlatılamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // Accept incoming call
  const handleAcceptCall = async () => {
    if (!incomingCall) return;
    
    setIsCallConnecting(true);
    clearIncomingCall();
    
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      // Setup audio elements
      const localAudio = document.getElementById('local-audio') as HTMLAudioElement;
      const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
      
      if (localAudio) {
        localAudio.srcObject = stream;
        localAudio.play().catch(e => console.log('Local audio play failed:', e));
      }

      if (!remoteAudio) {
        throw new Error('Remote audio element not found');
      }

      // Answer the call using WebRTC
      const pc = listenForCall(incomingCall.roomId, stream, remoteAudio);
      setPeerConnection(pc);
      
      // Listen for connection state
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsCallConnecting(false);
          setIsCallActive(true);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          endCall();
        }
      };

    } catch (error) {
      console.error('Error accepting call:', error);
      setIsCallConnecting(false);
      alert('Arama cevaplanamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // Reject incoming call
  const handleRejectCall = () => {
    clearIncomingCall();
    
    // Update call status in Firebase
    if (incomingCall) {
      const callRef = ref(db, `calls/${incomingCall.roomId}/status`);
      set(callRef, 'rejected');
    }
  };

  // End call
  const endCall = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setIsCallActive(false);
    setIsCallConnecting(false);

    // Clear audio elements
    const localAudio = document.getElementById('local-audio') as HTMLAudioElement;
    const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;
    
    if (localAudio) localAudio.srcObject = null;
    if (remoteAudio) remoteAudio.srcObject = null;

    console.log('Call ended');
  };

  // Redirect if no role
  useEffect(() => {
    if (!userRole) {
      router.push('/');
    }
  }, [userRole, router]);

  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Geçersiz arama parametreleri</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        
        {/* Header */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Akıllı Sesli Arama</h1>
          <p className="text-gray-600">
            {userRole === 'speaker' ? '🎤 Konuşmacı' : '👂 Dinleyici'} olarak katıldınız
          </p>
        </div>

        {/* Call Status */}
        <div className="mb-6">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            isCallActive ? 'bg-green-500' :
            isCallConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
          }`}></div>
          <p className="text-sm text-gray-600">
            {isCallActive ? 'Arama Aktif' :
             isCallConnecting ? 'Bağlanıyor...' : 'Arama Bekleniyor'}
          </p>
        </div>

        {/* Call Controls */}
        <div className="space-y-4">
          {isCallActive ? (
            <button
              onClick={endCall}
              className="w-full py-3 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
            >
              📞 Aramayı Sonlandır
            </button>
          ) : isCallConnecting ? (
            <button
              disabled
              className="w-full py-3 px-6 bg-yellow-500 text-white font-semibold rounded-xl"
            >
              🔄 Bağlanıyor...
            </button>
          ) : (
            <button
              onClick={handleStartCall}
              className="w-full py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
            >
              📞 Arama Başlat
            </button>
          )}

          <button
            onClick={() => router.push('/')}
            className="w-full py-2 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            🏠 Ana Sayfaya Dön
          </button>
        </div>

        {/* Room Info */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Oda ID: {roomId}</p>
          <p className="text-xs text-gray-400 mt-1">Akıllı Arama Sistemi</p>
        </div>
      </div>

      {/* Incoming Call Modal */}
      <IncomingCallModal
        isVisible={!!incomingCall}
        callerInfo={incomingCall || undefined}
        onAccept={handleAcceptCall}
        onReject={handleRejectCall}
      />

      {/* Hidden Audio Elements */}
      <audio id="local-audio" autoPlay muted style={{ display: 'none' }} />
      <audio id="remote-audio" autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}

export default function SmartCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <SmartCallContent />
    </Suspense>
  );
}
