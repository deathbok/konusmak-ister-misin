"use client";

import { useState } from "react";
import StartCallButton from "./StartCallButton";
import ListenCallButton from "./ListenCallButton";
import CallerButton from "./CallerButton";
import CalleeButton from "./CalleeButton";

export default function VoiceCallExample() {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [callStatus, setCallStatus] = useState<string>("Ready");

  const handleCallStarted = (pc: RTCPeerConnection) => {
    setPeerConnection(pc);
    setCallStatus("Call started");
    
    // Listen for connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setCallStatus(`Connection: ${pc.connectionState}`);
    };
  };

  const handleError = (error: string) => {
    setCallStatus(`Error: ${error}`);
  };

  const endCall = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
      setCallStatus("Call ended");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Voice Call Test</h1>
        
        {/* Status */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Status: {callStatus}</p>
        </div>

        {/* Audio Elements */}
        <div className="mb-6 space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local Audio</label>
            <audio id="local" controls muted className="w-full"></audio>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remote Audio</label>
            <audio id="remote" controls className="w-full"></audio>
          </div>
        </div>

        {/* Call Controls */}
        <div className="space-y-4">
          {!peerConnection ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StartCallButton
                  roomId="test-room-1"
                  onCallStarted={handleCallStarted}
                  onError={handleError}
                />

                <ListenCallButton
                  roomId="test-room-1"
                  onCallReceived={handleCallStarted}
                  onError={handleError}
                />
              </div>

              <div className="text-sm text-gray-500">veya</div>

              <div className="grid grid-cols-2 gap-3">
                <CallerButton
                  roomId="test-room-1"
                  onCallStarted={handleCallStarted}
                  onError={handleError}
                />

                <CalleeButton
                  roomId="test-room-1"
                  onCallReceived={handleCallStarted}
                  onError={handleError}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={endCall}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              End Call
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Make sure to allow microphone access when prompted.
            Open this page in two different browser tabs to test the call.
          </p>
        </div>
      </div>
    </div>
  );
}
