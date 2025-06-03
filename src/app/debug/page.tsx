'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from 'firebase/database';

export default function DebugPage() {
  const [firebaseStatus, setFirebaseStatus] = useState('Testing...');
  const [webrtcStatus, setWebrtcStatus] = useState('Testing...');
  const [microphoneStatus, setMicrophoneStatus] = useState('Testing...');
  const [stunStatus, setStunStatus] = useState('Testing...');

  useEffect(() => {
    testFirebase();
    testMicrophone();
    testWebRTC();
  }, []);

  const testFirebase = async () => {
    try {
      // Test Firebase connection
      const testRef = ref(db, 'debug/test');
      await set(testRef, {
        timestamp: Date.now(),
        message: 'Firebase test successful'
      });

      // Test reading
      onValue(testRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setFirebaseStatus('✅ Firebase Connected');
        } else {
          setFirebaseStatus('❌ Firebase Read Failed');
        }
      });
    } catch (error) {
      console.error('Firebase test error:', error);
      setFirebaseStatus(`❌ Firebase Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneStatus('✅ Microphone Access OK');
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Microphone test error:', error);
      setMicrophoneStatus(`❌ Microphone Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testWebRTC = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      pc.oniceconnectionstatechange = () => {
        console.log('ICE Connection State:', pc.iceConnectionState);
        setStunStatus(`ICE State: ${pc.iceConnectionState}`);
      };

      // Test creating offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      setWebrtcStatus('✅ WebRTC Peer Connection OK');
      
      // Clean up
      setTimeout(() => {
        pc.close();
      }, 5000);
    } catch (error) {
      console.error('WebRTC test error:', error);
      setWebrtcStatus(`❌ WebRTC Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testCall = async () => {
    try {
      const roomId = 'debug-room-' + Date.now();
      
      // Test Firebase signaling
      const callRef = ref(db, `calls/${roomId}/offer`);
      await set(callRef, {
        type: 'offer',
        sdp: 'test-sdp-data',
        timestamp: Date.now()
      });

      console.log('Test call data written to Firebase');
      
      // Listen for the data
      onValue(callRef, (snapshot) => {
        const data = snapshot.val();
        console.log('Test call data read from Firebase:', data);
      });

    } catch (error) {
      console.error('Test call error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">🔧 Debug Panel v1.1</h1>
        
        <div className="space-y-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Firebase Status</h3>
            <p className="text-sm">{firebaseStatus}</p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Microphone Status</h3>
            <p className="text-sm">{microphoneStatus}</p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">WebRTC Status</h3>
            <p className="text-sm">{webrtcStatus}</p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">STUN Server Status</h3>
            <p className="text-sm">{stunStatus}</p>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-gray-700 mb-2">Environment Variables</h3>
            <div className="text-xs space-y-1">
              <p>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}</p>
              <p>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing'}</p>
              <p>Database URL: {process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? '✅ Set' : '❌ Missing'}</p>
              <p>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}</p>
            </div>
          </div>

          <button
            onClick={testCall}
            className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            🧪 Test Firebase Signaling
          </button>

          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-700 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <a 
                href="/test-call" 
                className="block w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white text-center rounded-lg transition-colors"
              >
                🎤 Test Voice Call
              </a>
              <a 
                href="/simple-call?roomId=test-room&role=speaker&userId=test-user" 
                className="block w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white text-center rounded-lg transition-colors"
              >
                📞 Test Simple Call
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
