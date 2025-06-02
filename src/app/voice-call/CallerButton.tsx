"use client";

import { useState } from "react";
import { startCall as startWebRTCCall } from "@/lib/webrtc-simple";

interface CallerButtonProps {
  roomId: string;
  onCallStarted?: (peerConnection: RTCPeerConnection) => void;
  onError?: (error: string) => void;
}

export default function CallerButton({ roomId, onCallStarted, onError }: CallerButtonProps) {
  const [starting, setStarting] = useState(false);

  const startCall = async () => {
    setStarting(true);
    try {
      // Get user media
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup local audio element
      const localAudioElement = document.getElementById("local") as HTMLAudioElement;
      if (localAudioElement) {
        localAudioElement.srcObject = localStream;
        localAudioElement.play().catch(e => console.log('Local audio play failed:', e));
      }

      // Setup remote audio element
      const remoteAudioElement = document.getElementById("remote") as HTMLAudioElement;
      if (!remoteAudioElement) {
        throw new Error("Remote audio element not found");
      }

      // Start the WebRTC call
      const peerConnection = await startWebRTCCall(roomId, localStream, remoteAudioElement);
      
      // Notify parent component
      if (onCallStarted) {
        onCallStarted(peerConnection);
      }

    } catch (err) {
      const errorMessage = "Mikrofon erişimi alınamadı veya arama başlatılamadı.";
      console.error("Call start error:", err);
      
      if (onError) {
        onError(errorMessage);
      } else {
        alert(errorMessage);
      }
    }
    setStarting(false);
  };

  return (
    <button
      onClick={startCall}
      disabled={starting}
      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {starting ? "Aranıyor..." : "Kullanıcıyı Ara"}
    </button>
  );
}

// Note: The startCall function is internal to this component
// For external use, import startCall from "@/lib/webrtc-simple"
