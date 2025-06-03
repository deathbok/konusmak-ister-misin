'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, onValue, onChildAdded, set } from 'firebase/database';
import { WebRTCManager, createWebRTCManager } from '@/utils/webrtc';

type UserRole = 'speaker' | 'listener' | null;

function VoiceCallContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const userRole = searchParams.get('role') as UserRole;
  const userId = searchParams.get('userId');

  const [isCallActive, setIsCallActive] = useState(false);
  const [isCallConnecting, setIsCallConnecting] = useState(false);
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // End voice call
  const endCall = useCallback(() => {
    if (webrtcManager) {
      webrtcManager.cleanup();
    }

    setIsCallActive(false);
    setIsCallConnecting(false);
    setConnectionState('new');

    // Clear audio elements
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    console.log('Call ended');
  }, [webrtcManager]);

  // Initialize WebRTC manager
  useEffect(() => {
    if (!roomId || !userId) {
      router.push('/');
      return;
    }

    const manager = createWebRTCManager(roomId, userId, userRole as string);
    setWebrtcManager(manager);

    // Setup callbacks
    manager.onRemoteStream((stream) => {
      console.log('Remote stream received');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(e => console.log('Remote audio play failed:', e));
      }
    });

    manager.onConnectionState((state) => {
      console.log('Connection state:', state);
      setConnectionState(state);

      if (state === 'connected') {
        setIsCallConnecting(false);
        setIsCallActive(true);
      } else if (state === 'disconnected' || state === 'failed') {
        endCall();
      }
    });

    return () => {
      manager.cleanup();
    };
  }, [roomId, userId, userRole, router, endCall]);

  // Firebase signaling listeners
  useEffect(() => {
    if (!roomId || !userId || !webrtcManager) return;

    // Listen for offers
    const offerListener = onValue(ref(db, `calls/${roomId}/offer`), async snapshot => {
      const offer = snapshot.val();
      if (offer && offer.from !== userId && !isCallActive && !isCallConnecting) {
        console.log('Received call offer from:', offer.from);

        const peerConnection = webrtcManager.getPeerConnection();
        if (peerConnection && !peerConnection.currentRemoteDescription) {
          if (confirm('Gelen sesli arama var. Kabul etmek istiyor musunuz?')) {
            try {
              setIsCallConnecting(true);

              // Get user media first
              const stream = await webrtcManager.getUserMedia();
              if (localAudioRef.current) {
                localAudioRef.current.srcObject = stream;
                localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e));
              }

              // Initialize peer connection and add stream
              webrtcManager.initializePeerConnection();
              webrtcManager.addLocalStream(stream);

              // Handle the offer
              await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              // Firebase'e answer'ı yaz
              set(ref(db, `calls/${roomId}/answer`), {
                sdp: answer.sdp,
                type: answer.type,
                from: userId,
                timestamp: Date.now()
              });

              console.log('Call answered successfully');
            } catch (error) {
              console.error('Error answering call:', error);
              setIsCallConnecting(false);
            }
          }
        }
      }
    });

    // Listen for answers
    const answerListener = onValue(ref(db, `calls/${roomId}/answer`), async snapshot => {
      const answer = snapshot.val();
      if (answer) {
        console.log('Received answer, setting remote description...');

        const peerConnection = webrtcManager.getPeerConnection();
        if (peerConnection) {
          try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Answer set successfully');
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      }
    });

    // Karşı tarafın ICE candidate'larını dinle
    const getOtherUserId = () => {
      // Simple approach: use role-based other user detection
      return userRole === 'speaker' ? 'listener_user' : 'speaker_user';
    };

    const candidatesListener = onChildAdded(ref(db, `calls/${roomId}/candidates/${getOtherUserId()}`), snapshot => {
      const candidateData = snapshot.val();
      if (candidateData) {
        const peerConnection = webrtcManager.getPeerConnection();
        if (peerConnection) {
          try {
            console.log('Adding remote ICE candidate:', candidateData);
            const candidate = new RTCIceCandidate(candidateData);
            peerConnection.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      }
    });

    // Cleanup function will be called automatically by onValue
    return () => {
      // onValue returns unsubscribe functions
      if (typeof offerListener === 'function') offerListener();
      if (typeof answerListener === 'function') answerListener();
      if (typeof candidatesListener === 'function') candidatesListener();
    };
  }, [roomId, userId, webrtcManager, isCallActive, isCallConnecting, userRole]);

  // Start voice call
  const startCall = async () => {
    if (!webrtcManager) return;

    try {
      setIsCallConnecting(true);
      console.log('Starting call...');

      // Get user media
      const stream = await webrtcManager.getUserMedia();
      
      // Setup local audio
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
        localAudioRef.current.play().catch(e => console.log('Local audio play failed:', e));
      }

      // Initialize peer connection and add stream
      webrtcManager.initializePeerConnection();
      webrtcManager.addLocalStream(stream);

      // Create and send offer
      await webrtcManager.createOffer();

    } catch (error) {
      console.error('Error starting call:', error);
      setIsCallConnecting(false);
      alert('Arama başlatılamadı. Mikrofon erişimi kontrol edin.');
    }
  };

  // Cancel outgoing call
  const cancelCall = () => {
    endCall();
  };

  // Leave call and go back to chat
  const leaveCall = () => {
    // Always end call when leaving
    if (isCallActive || isCallConnecting) {
      endCall();
    }
    // Go back to chat page
    router.push(`/sohbet?roomId=${roomId}`);
  };

  // Go to home page
  const goToHome = () => {
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
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Sesli Arama</h1>
          <p className="text-gray-600">
            {userRole === 'speaker' ? '🎤 Konuşmacı' : '👂 Dinleyici'} olarak katıldınız
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
            connectionState === 'connected' ? 'bg-green-500' :
            connectionState === 'connecting' ? 'bg-yellow-500' :
            connectionState === 'failed' ? 'bg-red-500' : 'bg-gray-400'
          }`}></div>
          <p className="text-sm text-gray-600">
            {connectionState === 'connected' ? 'Bağlantı Kuruldu' :
             connectionState === 'connecting' ? 'Bağlanıyor...' :
             connectionState === 'failed' ? 'Bağlantı Başarısız' : 'Bağlantı Bekleniyor'}
          </p>
        </div>

        {/* Call Controls */}
        <div className="space-y-4">
          {isCallActive ? (
            // Arama aktif - Sonlandır butonu
            <button
              onClick={endCall}
              className="w-full py-3 px-6 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
            >
              📞 Aramayı Sonlandır
            </button>
          ) : isCallConnecting ? (
            // Arama bağlanıyor - İptal butonu
            <button
              onClick={cancelCall}
              className="w-full py-3 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
            >
              ❌ Aramayı İptal Et
            </button>
          ) : (
            // Arama bekleniyor - Başlat butonu
            <button
              onClick={startCall}
              className="w-full py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-colors"
            >
              📞 Aramayı Başlat
            </button>
          )}

          {/* Ayrıl - Sohbet sayfasına dön */}
          <button
            onClick={leaveCall}
            className="w-full py-2 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            🚪 Ayrıl
          </button>

          {/* Ana sayfaya dön */}
          <button
            onClick={goToHome}
            className="w-full py-2 px-6 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-xl transition-colors"
          >
            🏠 Ana Sayfa
          </button>
        </div>

        {/* Room Info */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Oda ID: {roomId}</p>
        </div>
      </div>

      {/* Hidden Audio Elements */}
      <audio ref={localAudioRef} autoPlay muted style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}

export default function VoiceCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    }>
      <VoiceCallContent />
    </Suspense>
  );
}
