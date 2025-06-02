"use client";

import { useState } from "react";
import { listenForCall as listenForWebRTCCall } from "@/lib/webrtc-simple";

interface ListenCallButtonProps {
  roomId?: string;
  onCallReceived?: (peerConnection: RTCPeerConnection) => void;
  onError?: (error: string) => void;
}

export default function ListenCallButton({ roomId = "test-room", onCallReceived, onError }: ListenCallButtonProps) {
  const [listening, setListening] = useState(false);

  const handleListen = async () => {
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
        throw new Error("Remote audio element not found. Make sure you have an audio element with id='remote'");
      }

      // Start listening for calls using the utility function
      const peerConnection = listenForWebRTCCall(roomId, localStream, remoteAudioElement);

      // Notify parent component if callback provided
      if (onCallReceived) {
        onCallReceived(peerConnection);
      }
      
      console.log("Started listening for incoming calls");

    } catch (err) {
      const errorMessage = "Mikrofona erişim sağlanamadı.";
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
      onClick={handleListen}
      disabled={listening}
      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg transition-colors"
    >
      {listening ? "Dinleniyor..." : "Dinlemeye Başla"}
    </button>
  );
}
