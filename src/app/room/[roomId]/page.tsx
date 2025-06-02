'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, push, onValue, off, serverTimestamp, get, set, onDisconnect } from 'firebase/database';

type UserRole = 'speaker' | 'listener' | null;

interface Message {
  id: string;
  text?: string;
  type?: 'text' | 'voice';
  audioData?: string;
  duration?: number;
  senderId: string;
  senderRole: UserRole;
  timestamp: number;
  createdAt: unknown;
}

interface Room {
  id: string;
  speaker: string;
  listener: string;
  createdAt: number;
  status: 'active' | 'ended';
}

function RoomPageContent() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [otherUserLeft, setOtherUserLeft] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string>('');

  const [presenceInitialized, setPresenceInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize user data
  useEffect(() => {
    const storedRole = localStorage.getItem('userRole') as UserRole;
    const storedUserId = localStorage.getItem('userId');

    if (!storedRole || !roomId) {
      router.push('/');
      return;
    }

    setUserRole(storedRole);

    // Generate or get user ID
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setUserId(newUserId);
      localStorage.setItem('userId', newUserId);
    }
  }, [router, roomId]);

  // Load room data and verify user access
  useEffect(() => {
    if (!roomId || !userId) return;

    const loadRoom = async () => {
      try {
        const roomRef = ref(db, `rooms/${roomId}`);
        const snapshot = await get(roomRef);
        const roomData = snapshot.val() as Room;

        if (!roomData) {
          alert('Oda bulunamadı!');
          router.push('/');
          return;
        }

        // Verify user is part of this room
        if (roomData.speaker !== userId && roomData.listener !== userId) {
          alert('Bu odaya erişim yetkiniz yok!');
          router.push('/');
          return;
        }

        // Set other user ID
        const otherUser = roomData.speaker === userId ? roomData.listener : roomData.speaker;
        setOtherUserId(otherUser);

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading room:', error);
        router.push('/');
      }
    };

    loadRoom();
  }, [roomId, userId, router]);

  // Set up user presence and monitor other user
  useEffect(() => {
    if (!roomId || !userId || !otherUserId) return;

    const setupPresence = async () => {
      try {
        // Set current user as online
        const userPresenceRef = ref(db, `rooms/${roomId}/presence/${userId}`);
        await set(userPresenceRef, {
          online: true,
          lastSeen: serverTimestamp()
        });

        // Set up disconnect handler
        const disconnectRef = onDisconnect(userPresenceRef);
        await disconnectRef.set({
          online: false,
          lastSeen: serverTimestamp()
        });

        // Monitor other user's presence with grace period
        const otherUserPresenceRef = ref(db, `rooms/${roomId}/presence/${otherUserId}`);
        let presenceTimeout: NodeJS.Timeout;

        const presenceListener = onValue(otherUserPresenceRef, (snapshot) => {
          const presenceData = snapshot.val();

          // Clear any existing timeout
          if (presenceTimeout) {
            clearTimeout(presenceTimeout);
          }

          if (presenceData && presenceData.online) {
            // User is definitely online
            setOtherUserLeft(false);
            setPresenceInitialized(true);
          } else if (presenceData && !presenceData.online) {
            // User explicitly went offline - but only if we've seen them online before
            if (presenceInitialized) {
              setOtherUserLeft(true);
            }
          } else if (!presenceInitialized) {
            // No presence data yet - give user 15 seconds to join before marking as left
            presenceTimeout = setTimeout(() => {
              setOtherUserLeft(true);
              setPresenceInitialized(true);
            }, 15000); // 15 second grace period for initial connection
          } else {
            // Presence data disappeared after being initialized - user likely left
            setOtherUserLeft(true);
          }
        });

        return () => {
          if (presenceTimeout) {
            clearTimeout(presenceTimeout);
          }
          off(otherUserPresenceRef, 'value', presenceListener);
        };
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    setupPresence();
  }, [roomId, userId, otherUserId, presenceInitialized]);

  // Listen for messages
  useEffect(() => {
    if (!roomId) return;

    const messagesRef = ref(db, `rooms/${roomId}/messages`);
    
    const messagesListener = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesList = Object.entries(data).map(([id, message]: [string, unknown]) => ({
          id,
          ...(message as Omit<Message, 'id'>)
        }));
        
        // Sort by timestamp
        messagesList.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(messagesList);
      } else {
        setMessages([]);
      }
    });

    return () => {
      off(messagesRef, 'value', messagesListener);
    };
  }, [roomId]);



  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !roomId || !userId || !userRole) return;

    try {
      const messagesRef = ref(db, `rooms/${roomId}/messages`);
      
      const messageData: Omit<Message, 'id'> = {
        type: 'text',
        text: newMessage.trim(),
        senderId: userId,
        senderRole: userRole,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      };

      await push(messagesRef, messageData);
      setNewMessage('');
      
      // Focus back to input
      inputRef.current?.focus();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Mikrofon erişimi reddedildi. Lütfen tarayıcı ayarlarından mikrofon iznini kontrol edin.');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Send voice message
  const sendVoiceMessage = async () => {
    if (!audioBlob || !userRole || !roomId) return;

    // Convert blob to base64 for Firebase storage
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Audio = reader.result as string;

      const messagesRef = ref(db, `rooms/${roomId}/messages`);
      const messageData = {
        type: 'voice',
        audioData: base64Audio,
        duration: recordingTime,
        senderId: userId,
        senderRole: userRole,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      };

      try {
        await push(messagesRef, messageData);
        setAudioBlob(null);
        setRecordingTime(0);
      } catch (error) {
        console.error('Error sending voice message:', error);
      }
    };

    reader.readAsDataURL(audioBlob);
  };

  // Cancel voice recording
  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      setAudioBlob(null);
      setRecordingTime(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  // Leave chat
  const leaveChat = async () => {

    if (roomId && userId) {
      try {
        // Mark user as offline
        const userPresenceRef = ref(db, `rooms/${roomId}/presence/${userId}`);
        await set(userPresenceRef, {
          online: false,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating presence on leave:', error);
      }
    }

    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    router.push('/');
  };

  // Rejoin queue (for "Yeniden Eşleş" button)
  const rejoinQueue = async () => {
    if (roomId && userId) {
      try {
        // Mark user as offline
        const userPresenceRef = ref(db, `rooms/${roomId}/presence/${userId}`);
        await set(userPresenceRef, {
          online: false,
          lastSeen: serverTimestamp()
        });
      } catch (error) {
        console.error('Error updating presence on rejoin:', error);
      }
    }
    
    // Keep userRole but go back to matching
    router.push('/eslesme');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Oda yükleniyor...</p>
        </div>
      </div>
    );
  }

  const getRoleEmoji = (role: UserRole) => {
    return role === 'speaker' ? '💬' : '👂';
  };

  const getRoleText = (role: UserRole) => {
    return role === 'speaker' ? 'Konuşmacı' : 'Dinleyici';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100 relative">
      {/* Other User Left Overlay - Only show if presence was initialized */}
      {otherUserLeft && presenceInitialized && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Karşı taraf sohbeti terk etti
            </h2>
            <p className="text-gray-600 mb-6 text-sm">
              Sohbet partnerin bağlantıyı sonlandırdı. Yeni bir eşleşme aramak ister misin?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={rejoinQueue}
                className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all duration-200"
              >
                🔄 Yeniden Eşleş
              </button>
              <button
                onClick={leaveChat}
                className="w-full py-3 px-6 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-xl transition-all duration-200"
              >
                🚪 Çık
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Üst Başlık Barı - "Sohbet Başladı" - Ortalanmış */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 flex-shrink-0 flex justify-center">
        <div className="flex items-center justify-between w-full max-w-4xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 32 32"
                fill="none"
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
              >
                <path
                  d="M6 10C6 7.79086 7.79086 6 10 6H22C24.2091 6 26 7.79086 26 10V16C26 18.2091 24.2091 20 22 20H18L14 24V20H10C7.79086 20 6 18.2091 6 16V10Z"
                  fill="#3B82F6"
                />
                <circle cx="12" cy="13" r="1.5" fill="white"/>
                <circle cx="16" cy="13" r="1.5" fill="white"/>
                <circle cx="20" cy="13" r="1.5" fill="white"/>
              </svg>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                !presenceInitialized ? 'bg-yellow-500' :
                !otherUserLeft ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-gray-800 truncate">
              Sohbet Başladı
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-gray-600">
                {getRoleEmoji(userRole)} {getRoleText(userRole)}
              </p>
              <p className="text-xs text-gray-500">
                {!presenceInitialized ? 'Bağlanıyor...' :
                 !otherUserLeft ? 'Çevrimiçi' : 'Çevrimdışı'}
              </p>
            </div>
            <div className="block sm:hidden">
              <p className="text-xs text-gray-600">
                {getRoleEmoji(userRole)}
              </p>
            </div>

            {/* Call Buttons */}
            {!otherUserLeft && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => router.push(`/voice-call?roomId=${roomId}&role=${userRole}&userId=${userId}`)}
                  className="px-2 sm:px-3 py-1 sm:py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all duration-200 text-sm flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  <span className="hidden sm:inline">Sesli</span>
                </button>
                <button
                  onClick={() => router.push(`/video-call?roomId=${roomId}&role=${userRole}&userId=${userId}`)}
                  className="px-2 sm:px-3 py-1 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 text-sm flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                  <span className="hidden sm:inline">Video</span>
                </button>
                <button
                  onClick={() => router.push(`/simple-call?roomId=${roomId}&role=${userRole}&userId=${userId}`)}
                  className="px-2 sm:px-3 py-1 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all duration-200 text-sm flex items-center gap-1"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  <span className="hidden sm:inline">Basit</span>
                </button>
              </div>
            )}

            <button
              onClick={leaveChat}
              className="px-2 sm:px-3 py-1 sm:py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-200 text-sm flex-shrink-0"
            >
              <span className="hidden sm:inline">Sohbeti Bitir</span>
              <span className="sm:hidden text-base">✕</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mesajlar Alanı - Ortalanmış */}
      <div className="flex-1 overflow-y-auto flex justify-center">
        <div className="w-full max-w-4xl px-3 sm:px-4 py-4">
          <div className="space-y-4 sm:space-y-5">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Henüz mesaj yok. İlk mesajı gönderin!
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isMyMessage = message.senderId === userId;
                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Sade Mesaj Kutusu */}
                    <div
                      className={`min-w-[120px] max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] px-6 sm:px-8 py-4 sm:py-5 rounded-2xl shadow-sm ${
                        isMyMessage
                          ? 'bg-blue-500 text-white rounded-br-lg'
                          : 'bg-white text-gray-800 border border-gray-200 rounded-bl-lg'
                      }`}
                    >
                      {message.type === 'voice' ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                            </svg>
                            <span className="text-sm">Ses mesajı</span>
                          </div>
                          <audio
                            controls
                            className="flex-1 max-w-[200px]"
                            style={{
                              filter: isMyMessage ? 'invert(1)' : 'none',
                              height: '32px'
                            }}
                          >
                            <source src={message.audioData} type="audio/webm" />
                            Tarayıcınız ses oynatmayı desteklemiyor.
                          </audio>
                          <span className="text-xs opacity-75">
                            {formatTime(message.duration || 0)}
                          </span>
                        </div>
                      ) : (
                        <p className={`text-base leading-relaxed break-words text-left ${
                          isMyMessage ? 'text-white' : 'text-gray-800'
                        }`} style={{ wordSpacing: '0.1em' }}>{message.text}</p>
                      )}
                      <p className={`text-xs mt-3 sm:mt-4 text-right ${
                        isMyMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Alt Sabit Mesaj Yazma Kutusu - Ortalanmış */}
      <div className="bg-white border-t border-gray-200 px-3 sm:px-4 py-3 flex-shrink-0 flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Voice Recording UI */}
          {isRecording && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-700 font-medium">Kayıt ediliyor...</span>
                <span className="text-red-600 text-sm">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={stopRecording}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                >
                  Durdur
                </button>
                <button
                  onClick={cancelRecording}
                  className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          )}

          {/* Audio Preview */}
          {audioBlob && !isRecording && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                  <span className="text-blue-700 font-medium">Ses kaydı hazır</span>
                  <span className="text-blue-600 text-sm">{formatTime(recordingTime)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={sendVoiceMessage}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Gönder
                  </button>
                  <button
                    onClick={() => setAudioBlob(null)}
                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Sil
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3 items-end">
            <div className="flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={otherUserLeft ? "Karşı taraf ayrıldı..." : "Mesajınızı yazın..."}
                disabled={otherUserLeft || isRecording}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 text-gray-800 text-sm disabled:bg-gray-200 disabled:cursor-not-allowed"
                maxLength={500}
              />
            </div>

            {/* Voice Record Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={otherUserLeft || audioBlob !== null}
              className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-medium transition-all duration-200 text-sm min-w-[50px] sm:min-w-[60px] flex items-center justify-center flex-shrink-0 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>

            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || otherUserLeft || isRecording}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl sm:rounded-2xl font-medium transition-all duration-200 text-sm min-w-[60px] sm:min-w-[80px] flex items-center justify-center flex-shrink-0"
            >
              <span className="hidden sm:inline">Gönder</span>
              <span className="sm:hidden text-base">📤</span>
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center px-2">
            {otherUserLeft
              ? "Sohbet sonlandırıldı. Mesaj gönderemezsiniz."
              : (
                <span className="block sm:inline">
                  <span className="block sm:inline">{newMessage.length}/500 karakter</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">Enter tuşuna basarak da gönderebilirsiniz</span>
                </span>
              )
            }
          </div>
        </div>
      </div>


    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Oda yükleniyor...</p>
        </div>
      </div>
    }>
      <RoomPageContent />
    </Suspense>
  );
}
