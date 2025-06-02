'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startCall, answerCall, endCall, getUserMedia, listenForCall } from '@/lib/webrtc-simple';

type UserRole = 'speaker' | 'listener' | null;

export default function SimpleCallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const userRole = searchParams.get('role') as UserRole;
  const userId = searchParams.get('userId');

  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Start call as caller
  const handleStartCall = async () => {
    if (!roomId || !remoteAudioRef.current) return;

    try {
      setIsCallConnecting(true);
      console.log('Starting call...');

      // Get user media
      const stream = await getUserMedia();
      setLocalStream(stream);

      // Setup local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e));
      }

      // Start call
      const pc = await startCall(roomId, stream, remoteAudioRef.current);
      setPeerConnection(pc);

      // Listen for connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsCallConnecting(false);
          setIsCallActive(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleEndCall();
        }
      };

    } catch (error) {
      console.error('Error starting call:', error);
      setIsCallConnecting(false);
      alert('Arama başlatılamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // Answer incoming call
  const handleAnswerCall = async () => {
    if (!roomId || !remoteAudioRef.current) return;

    try {
      setIsCallConnecting(true);
      console.log('Answering call...');

      // Get user media
      const stream = await getUserMedia();
      setLocalStream(stream);

      // Setup local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e));
      }

      // Answer call
      const pc = await answerCall(roomId, stream, remoteAudioRef.current);
      setPeerConnection(pc);

      // Listen for connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsCallConnecting(false);
          setIsCallActive(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleEndCall();
        }
      };

    } catch (error) {
      console.error('Error answering call:', error);
      setIsCallConnecting(false);
      alert('Arama cevaplanamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // Listen for incoming calls
  const handleListenForCall = async () => {
    if (!roomId || !remoteAudioRef.current) return;

    try {
      setIsCallConnecting(true);
      console.log('Listening for incoming calls...');

      // Get user media
      const stream = await getUserMedia();
      setLocalStream(stream);

      // Setup local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e));
      }

      // Listen for call
      const pc = listenForCall(roomId, stream, remoteAudioRef.current);
      setPeerConnection(pc);

      // Listen for connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setIsCallConnecting(false);
          setIsCallActive(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          handleEndCall();
        }
      };

    } catch (error) {
      console.error('Error listening for call:', error);
      setIsCallConnecting(false);
      alert('Arama dinleme başlatılamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // End call
  const handleEndCall = async () => {
    if (peerConnection && roomId) {
      await endCall(roomId, peerConnection);
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Clear audio elements
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setPeerConnection(null);
    setIsCallActive(false);
    setIsCallConnecting(false);

    console.log('Call ended');
  };

  // Leave and go back
  const leaveCall = () => {
    handleEndCall();
    router.push('/');
  };

  if (!roomId || !userId || !userRole) {
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
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Basit Sesli Arama</h1>
          <p className="text-gray-600">
            {userRole === 'speaker' ? '🎤 Konuşmacı' : '👂 Dinleyici'} olarak katıldınız
          </p>
        </div>

        {/* Call Controls */}
        <div className="space-y-4">
          {isCallActive ? (
            <button
              onClick={handleEndCall}
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
            <div className="space-y-3">
              <button
                onClick={handleStartCall}
                className="w-full py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
              >
                📞 Arama Başlat (Caller)
              </button>
              <button
                onClick={handleAnswerCall}
                className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
              >
                📞 Aramayı Cevapla (Callee)
              </button>
              <button
                onClick={handleListenForCall}
                className="w-full py-3 px-6 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl transition-colors"
              >
                👂 Arama Dinle (Auto Answer)
              </button>
            </div>
          )}

          <button
            onClick={leaveCall}
            className="w-full py-2 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            🚪 Ayrıl
          </button>
        </div>

        {/* Room Info */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Oda ID: {roomId}</p>
          <p className="text-xs text-gray-400 mt-1">Simple WebRTC Implementation</p>
        </div>
      </div>

      {/* Hidden Audio Elements */}
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
