'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, push, onValue, off, serverTimestamp, get, set, onDisconnect } from 'firebase/database';

type UserRole = 'speaker' | 'listener' | null;

interface Message {
  id: string;
  text: string;
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

function SohbetPageContent() {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  // const [room, setRoom] = useState<Room | null>(null);
  const [otherUserLeft, setOtherUserLeft] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
    const urlRoomId = searchParams.get('roomId');

    if (!storedRole || !urlRoomId) {
      router.push('/');
      return;
    }

    setUserRole(storedRole);
    setRoomId(urlRoomId);

    // Generate or get user ID
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setUserId(newUserId);
      localStorage.setItem('userId', newUserId);
    }
  }, [router, searchParams]);

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

        // setRoom(roomData);
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

        // Monitor other user's presence
        const otherUserPresenceRef = ref(db, `rooms/${roomId}/presence/${otherUserId}`);
        const presenceListener = onValue(otherUserPresenceRef, (snapshot) => {
          const presenceData = snapshot.val();
          if (presenceData) {
            setOtherUserLeft(!presenceData.online);
          } else {
            // If presence data doesn't exist, assume user left
            setOtherUserLeft(true);
          }
        });

        return () => {
          off(otherUserPresenceRef, 'value', presenceListener);
        };
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    setupPresence();
  }, [roomId, userId, otherUserId]);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Sohbet yükleniyor...</p>
        </div>
      </div>
    );
  }

  const getOtherUserRole = () => {
    return userRole === 'speaker' ? 'listener' : 'speaker';
  };

  const getRoleEmoji = (role: UserRole) => {
    return role === 'speaker' ? '💬' : '👂';
  };

  const getRoleText = (role: UserRole) => {
    return role === 'speaker' ? 'Konuşmacı' : 'Dinleyici';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex flex-col relative">
      {/* Other User Left Overlay */}
      {otherUserLeft && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-xl">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Karşı taraf sohbeti terk etti
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Sohbet partnerin bağlantıyı sonlandırdı. Yeni bir eşleşme aramak ister misin?
            </p>
            <div className="space-y-3">
              <button
                onClick={rejoinQueue}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                🔄 Yeniden Eşleş
              </button>
              <button
                onClick={leaveChat}
                className="w-full py-3 px-6 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                🚪 Çık
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{getRoleEmoji(userRole)}</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Anonim Sohbet
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Sen: {getRoleText(userRole)} • Karşı taraf: {getRoleText(getOtherUserRole())}
                {otherUserLeft && (
                  <span className="text-red-500 ml-2">● Çevrimdışı</span>
                )}
                {!otherUserLeft && (
                  <span className="text-green-500 ml-2">● Çevrimiçi</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Akıllı Sesli Arama */}
            <a
              href={`/smart-call?roomId=${roomId}&role=${userRole}&userId=${userId}`}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              📞 Akıllı Arama
            </a>

            {/* Normal Sesli Arama */}
            <a
              href={`/voice-call?roomId=${roomId}&role=${userRole}&userId=${userId}`}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              🎤 Sesli Arama
            </a>

            {/* Sohbeti Bitir */}
            <button
              onClick={leaveChat}
              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              Bitir
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col p-4">
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <div className="text-4xl mb-2">💭</div>
                <p>Henüz mesaj yok. İlk mesajı sen gönder!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isMyMessage = message.senderId === userId;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isMyMessage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs">
                            {getRoleEmoji(message.senderRole)}
                          </span>
                          <span className="text-xs opacity-75">
                            {isMyMessage ? 'Sen' : getRoleText(message.senderRole)}
                          </span>
                        </div>
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <div className="flex space-x-3">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={otherUserLeft ? "Karşı taraf ayrıldı..." : "Mesajınızı yazın..."}
                disabled={otherUserLeft}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-200 disabled:dark:bg-gray-600 disabled:cursor-not-allowed"
                maxLength={500}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || otherUserLeft}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200"
              >
                Gönder
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {otherUserLeft
                ? "Sohbet sonlandırıldı. Mesaj gönderemezsiniz."
                : "Enter tuşuna basarak da mesaj gönderebilirsiniz"
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SohbetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Sohbet yükleniyor...</p>
        </div>
      </div>
    }>
      <SohbetPageContent />
    </Suspense>
  );
}
