'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { startCall, endCall, getUserMediaWithVideo, listenForCall } from '@/lib/webrtc-simple';

type UserRole = 'speaker' | 'listener' | null;

function VideoCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const userRole = searchParams.get('role') as UserRole;
  const userId = searchParams.get('userId');

  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Start call as caller
  const handleStartCall = async () => {
    if (!roomId || !remoteVideoRef.current) return;

    try {
      setIsCallConnecting(true);
      console.log('Starting video call...');

      // Get user media with video
      const stream = await getUserMediaWithVideo();
      setLocalStream(stream);

      // Setup local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.log('Local video play failed:', e));
      }

      // Start call
      const pc = await startCall(roomId, stream, remoteVideoRef.current);
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
      console.error('Error starting video call:', error);
      setIsCallConnecting(false);
      alert('Video arama başlatılamadı. Kamera ve mikrofon erişimi kontrol edin.');
    }
  };

  // Listen for incoming calls
  const handleListenForCall = async () => {
    if (!roomId || !remoteVideoRef.current) return;

    try {
      setIsCallConnecting(true);
      console.log('Listening for incoming video calls...');

      // Get user media with video
      const stream = await getUserMediaWithVideo();
      setLocalStream(stream);

      // Setup local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.log('Local video play failed:', e));
      }

      // Listen for call
      const pc = listenForCall(roomId, stream, remoteVideoRef.current);
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
      console.error('Error listening for video call:', error);
      setIsCallConnecting(false);
      alert('Video arama dinleme başlatılamadı. Kamera ve mikrofon erişimi kontrol edin.');
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

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setPeerConnection(null);
    setIsCallActive(false);
    setIsCallConnecting(false);

    console.log('Video call ended');
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
          <h1 className="text-white text-lg font-bold">Video Arama</h1>
          <span className="text-gray-400 text-sm">
            {userRole === 'speaker' ? '🎤 Konuşmacı' : '👂 Dinleyici'}
          </span>
        </div>
        
        <button
          onClick={leaveCall}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          🚪 Ayrıl
        </button>
      </div>

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {/* Remote Video */}
        <video 
          ref={remoteVideoRef}
          id="remote" 
          autoPlay 
          playsInline
          className="w-full h-full object-cover"
          style={{ display: isCallActive ? 'block' : 'none' }}
        />
        
        {/* Local Video */}
        <video 
          ref={localVideoRef}
          id="local" 
          autoPlay 
          playsInline 
          muted
          className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg object-cover border-2 border-gray-600"
          style={{ display: (isCallActive || isCallConnecting) ? 'block' : 'none' }}
        />

        {/* No Call State */}
        {!isCallActive && !isCallConnecting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-4">Video Arama</h2>
              <p className="text-gray-400 mb-8">Arama başlatmak için aşağıdaki butonları kullanın</p>
            </div>
          </div>
        )}

        {/* Connecting State */}
        {isCallConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-xl">Bağlanıyor...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="max-w-md mx-auto">
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
                📹 Video Arama Başlat
              </button>
              <button
                onClick={handleListenForCall}
                className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
              >
                👁️ Video Arama Dinle
              </button>
            </div>
          )}
        </div>
        
        {/* Room Info */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">Oda ID: {roomId}</p>
        </div>
      </div>
    </div>
  );
}

export default function VideoCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <VideoCallContent />
    </Suspense>
  );
}
