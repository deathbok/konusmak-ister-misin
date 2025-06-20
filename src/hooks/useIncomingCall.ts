'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, off } from 'firebase/database';

interface IncomingCall {
  roomId: string;
  callerId: string;
  callerRole: string;
  timestamp: number;
}

interface RoomData {
  offer?: unknown;
  answer?: unknown;
  callerId?: string;
  callerRole?: string;
  targetRole?: string;
  timestamp?: number;
  status?: string;
}

export function useIncomingCall(userId: string, userRole: string) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (!userId || !userRole) return;

    setIsListening(true);

    // Listen for incoming calls in the calls database
    const callsRef = ref(db, 'calls');
    
    const handleIncomingCall = (snapshot: { val: () => Record<string, unknown> | null }) => {
      const calls = snapshot.val();
      if (!calls) return;

      // Check all rooms for new offers
      Object.keys(calls).forEach(roomId => {
        const roomData = calls[roomId] as RoomData;

        // If there's a call and we're not the caller
        if (roomData?.callerId && roomData.callerId !== userId && roomData?.status === 'calling') {
          // Check if this call is meant for our role
          const targetRole = roomData.targetRole;
          if (targetRole && targetRole === userRole) {
            // Check if we haven't already answered
            if (!roomData.answer) {
              const callInfo: IncomingCall = {
                roomId,
                callerId: roomData.callerId,
                callerRole: roomData.callerRole || 'unknown',
                timestamp: roomData.timestamp || Date.now()
              };

              // Only show if it's a recent call (within last 30 seconds)
              const now = Date.now();
              if (now - callInfo.timestamp < 30000) {
                setIncomingCall(callInfo);
              }
            }
          }
        }
      });
    };

    onValue(callsRef, handleIncomingCall);

    return () => {
      off(callsRef, 'value', handleIncomingCall);
      setIsListening(false);
    };
  }, [userId, userRole]);

  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  return {
    incomingCall,
    isListening,
    clearIncomingCall
  };
}
