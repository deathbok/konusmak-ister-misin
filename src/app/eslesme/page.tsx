'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, set, push, onValue, off, remove, get } from 'firebase/database';

type UserRole = 'speaker' | 'listener' | null;

// interface QueueUser {
//   id: string;
//   role: UserRole;
//   timestamp: number;
// }

interface Room {
  id: string;
  speaker: string;
  listener: string;
  createdAt: number;
  status: 'active' | 'ended';
}

export default function EslesmePage() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isInQueue, setIsInQueue] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [queueCount, setQueueCount] = useState({ speakers: 0, listeners: 0 });
  const [queueStartTime, setQueueStartTime] = useState<number | null>(null);

  const [countdown, setCountdown] = useState(30);
  const router = useRouter();

  // Generate unique user ID
  useEffect(() => {
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setUserId(id);
  }, []);

  // Get user role from localStorage
  useEffect(() => {
    const storedRole = localStorage.getItem('userRole') as UserRole;
    if (!storedRole) {
      router.push('/');
      return;
    }
    setUserRole(storedRole);
  }, [router]);

  // Monitor queue counts
  useEffect(() => {
    const speakersRef = ref(db, 'queue/speakers');
    const listenersRef = ref(db, 'queue/listeners');

    const speakersListener = onValue(speakersRef, (snapshot) => {
      const data = snapshot.val();
      setQueueCount(prev => ({ ...prev, speakers: data ? Object.keys(data).length : 0 }));
    });

    const listenersListener = onValue(listenersRef, (snapshot) => {
      const data = snapshot.val();
      setQueueCount(prev => ({ ...prev, listeners: data ? Object.keys(data).length : 0 }));
    });

    return () => {
      off(speakersRef, 'value', speakersListener);
      off(listenersRef, 'value', listenersListener);
    };
  }, []);

  // Remove from queue
  const removeFromQueue = useCallback(async () => {
    if (!userRole || !userId) return;

    try {
      await remove(ref(db, `queue/${userRole}s/${userId}`));
      setIsInQueue(false);
      setQueueStartTime(null);

    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  }, [userRole, userId]);

  // Leave queue
  const leaveQueue = useCallback(async () => {
    await removeFromQueue();
    router.push('/');
  }, [removeFromQueue, router]);

  // Timer for queue waiting time and countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isInQueue && queueStartTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - queueStartTime) / 1000);

        // 30 second countdown
        const remaining = Math.max(0, 30 - elapsed);
        setCountdown(remaining);

        // Auto leave queue after 30 seconds
        if (remaining === 0) {
          leaveQueue();
        }
      }, 1000);
    } else {
      setCountdown(30);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isInQueue, queueStartTime, leaveQueue]);

  // Join queue
  const joinQueue = async () => {
    if (!userRole || !userId) return;

    try {
      const startTime = Date.now();
      setIsInQueue(true);
      setQueueStartTime(startTime);

      // Add user to appropriate queue
      const queueRef = ref(db, `queue/${userRole}s/${userId}`);
      await set(queueRef, {
        id: userId,
        role: userRole,
        timestamp: startTime
      });

      // Check for immediate match
      await checkForMatch();

      // Listen for matches
      const userMatchRef = ref(db, `matches/${userId}`);
      const matchListener = onValue(userMatchRef, (snapshot) => {
        const matchData = snapshot.val();
        if (matchData && matchData.roomId) {
          setIsMatched(true);
          setRoomId(matchData.roomId);
          // Remove from queue
          removeFromQueue();
          // Clean up match data
          remove(userMatchRef);
        }
      });

      // Cleanup function will be called when component unmounts
      return () => {
        off(userMatchRef, 'value', matchListener);
        removeFromQueue();
      };
    } catch (error) {
      console.error('Error joining queue:', error);
      setIsInQueue(false);
    }
  };

  // Check for existing matches
  const checkForMatch = async () => {
    if (!userRole || !userId) return;

    const oppositeRole = userRole === 'speaker' ? 'listener' : 'speaker';
    const oppositeQueueRef = ref(db, `queue/${oppositeRole}s`);
    
    try {
      const snapshot = await get(oppositeQueueRef);
      const oppositeUsers = snapshot.val();
      
      if (oppositeUsers) {
        // Get the first user from opposite queue (FIFO)
        const oppositeUserIds = Object.keys(oppositeUsers);
        const matchedUserId = oppositeUserIds[0];
        
        // Create room
        const roomRef = push(ref(db, 'rooms'));
        const newRoomId = roomRef.key;
        
        if (newRoomId) {
          const roomData: Room = {
            id: newRoomId,
            speaker: userRole === 'speaker' ? userId : matchedUserId,
            listener: userRole === 'listener' ? userId : matchedUserId,
            createdAt: Date.now(),
            status: 'active'
          };
          
          // Save room
          await set(roomRef, roomData);
          
          // Notify both users about the match
          await set(ref(db, `matches/${userId}`), { roomId: newRoomId });
          await set(ref(db, `matches/${matchedUserId}`), { roomId: newRoomId });
          
          // Remove matched user from opposite queue
          await remove(ref(db, `queue/${oppositeRole}s/${matchedUserId}`));
        }
      }
    } catch (error) {
      console.error('Error checking for match:', error);
    }
  };

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInQueue) {
        removeFromQueue();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isInQueue) {
        removeFromQueue();
      }
    };
  }, [isInQueue, removeFromQueue]);

  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const getRoleText = () => userRole === 'speaker' ? 'konuşmacı' : 'dinleyici';
  const getRoleEmoji = () => userRole === 'speaker' ? '💬' : '👂';



  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        {isMatched ? (
          // Match found screen
          <div className="space-y-6">
            <div className="text-6xl animate-bounce">🎉</div>
            <h1 className="text-3xl font-bold text-green-600">
              Eşleşme Başladı!
            </h1>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                Sohbet başlamaya hazır!
              </p>
              <p className="text-green-600 text-sm mt-2">
                Oda ID: {roomId}
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => {
                  // Store userId for chat page
                  localStorage.setItem('userId', userId);
                  // Navigate to room with roomId
                  router.push(`/room/${roomId}`);
                }}
                className="w-full py-4 px-6 bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Sohbete Başla
              </button>

              <button
                onClick={() => router.push('/')}
                className="w-full py-3 px-6 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-xl transition-colors duration-200"
              >
                Ana Sayfaya Dön
              </button>
            </div>
          </div>
        ) : !isInQueue ? (
          // Join queue screen
          <div className="space-y-6">
            <div className="text-6xl">{getRoleEmoji()}</div>
            <h1 className="text-3xl font-bold text-gray-800">
              Eşleşme Sistemi
            </h1>
            <p className="text-lg text-gray-600">
              {getRoleText()} olarak kuyruğa katılmaya hazır mısın?
            </p>

            {/* Queue status */}
            <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Kuyruk Durumu</h3>
              <div className="flex justify-between text-sm">
                <span className="text-blue-500">💬 Konuşmacılar: {queueCount.speakers}</span>
                <span className="text-blue-500">👂 Dinleyiciler: {queueCount.listeners}</span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={joinQueue}
                className="w-full py-4 px-6 bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                Kuyruğa Katıl
              </button>

              <button
                onClick={() => router.push('/')}
                className="w-full py-3 px-6 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-xl transition-colors duration-200"
              >
                Geri Dön
              </button>
            </div>
          </div>
        ) : (
          // Waiting in queue screen - Yeni Tasarım
          <div className="h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="max-w-sm w-full text-center space-y-8">

              {/* Ana Başlık */}
              <div className="space-y-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                  Eşleşme Bekleniyor...
                </h1>
                <p className="text-base sm:text-lg text-gray-600">
                  {userRole === 'speaker' ? 'Dinleyici' : 'Konuşmacı'} aranıyor
                </p>
              </div>

              {/* Loading Animasyonu - Tailwind Dönme */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-500"></div>
              </div>

              {/* 30 Saniyelik Geri Sayım */}
              <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                <div className="text-4xl font-bold text-blue-500 mb-2">
                  {countdown}
                </div>
                <p className="text-sm text-gray-600">
                  saniye kaldı
                </p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(countdown / 30) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* İptal Et Butonu */}
              <div className="space-y-4">
                <button
                  onClick={leaveQueue}
                  className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm"
                >
                  İptal Et
                </button>

                <p className="text-xs text-gray-500 px-4">
                  Eşleşme bulunana kadar bekleyebilir veya iptal edebilirsiniz
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
