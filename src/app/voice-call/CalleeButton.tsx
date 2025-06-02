"use client";

import { useState } from "react";
import { listenForCall as listenForWebRTCCall } from "@/lib/webrtc-simple";

interface CalleeButtonProps {
  roomId: string;
  onCallReceived?: (peerConnection: RTCPeerConnection) => void;
  onError?: (error: string) => void;
}

export default function CalleeButton({ roomId, onCallReceived, onError }: CalleeButtonProps) {
  const [listening, setListening] = useState(false);

  const listenForCall = async () => {
    setListening(true);
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

      // Start listening for incoming calls
      const peerConnection = listenForWebRTCCall(roomId, localStream, remoteAudioElement);
      
      // Notify parent component
      if (onCallReceived) {
        onCallReceived(peerConnection);
      }

      console.log("Started listening for calls");

    } catch (err) {
      const errorMessage = "Mikrofon erişimi alınamadı veya dinleme başlatılamadı.";
      console.error("Listen error:", err);
      
      if (onError) {
        onError(errorMessage);
      } else {
        alert(errorMessage);
      }
      setListening(false);
    }
  };

  return (
    <button
      onClick={listenForCall}
      disabled={listening}
      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {listening ? "Dinleniyor..." : "Arama Dinle"}
    </button>
  );
}

// Note: The listenForCall function is internal to this component
// For external use, import listenForCall from "@/lib/webrtc-simple"
