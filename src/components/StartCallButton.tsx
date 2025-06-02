"use client";

import { useState } from "react";
import { startCall as startWebRTCCall } from "@/lib/webrtc-simple";

interface StartCallButtonProps {
  roomId?: string;
  onCallStarted?: (peerConnection: RTCPeerConnection) => void;
  onError?: (error: string) => void;
}

export default function StartCallButton({ roomId = "test-room", onCallStarted, onError }: StartCallButtonProps) {
  const [starting, setStarting] = useState(false);

  const handleStart = async () => {
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
        throw new Error("Remote audio element not found. Make sure you have an audio element with id='remote'");
      }

      // Start the WebRTC call using the utility function
      const peerConnection = await startWebRTCCall(roomId, localStream, remoteAudioElement);
      
      // Notify parent component if callback provided
      if (onCallStarted) {
        onCallStarted(peerConnection);
      }

      console.log("Call started successfully");

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
      onClick={handleStart}
      disabled={starting}
      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {starting ? "Aranıyor..." : "Kullanıcıyı Ara"}
    </button>
  );
}
