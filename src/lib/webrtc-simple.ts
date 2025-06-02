"use client";

import { db } from "@/lib/firebase";
import { createPeerConnection } from "@/utils/webrtc";
import { ref, set, onChildAdded, push, onValue } from "firebase/database";

export async function startCall(roomId: string, localStream: MediaStream, remoteElement: HTMLVideoElement | HTMLAudioElement) {
  console.log('🚀 Starting call for room:', roomId);

  const pc = createPeerConnection((event) => {
    console.log('📡 Received remote track:', event.track.kind);
    const remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    remoteElement.srcObject = remoteStream;
    remoteElement.play().catch(e => console.log('Remote media play failed:', e));
  });

  // Local stream ekle
  console.log('🎤 Adding local tracks:', localStream.getTracks().length);
  localStream.getTracks().forEach((track) => {
    console.log('Adding track:', track.kind, track.enabled);
    pc.addTrack(track, localStream);
  });

  console.log('📝 Creating offer...');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log('✅ Local description set');

  // Offer'ı Firebase'e yaz
  console.log('🔥 Sending offer to Firebase...');
  await set(ref(db, `calls/${roomId}/offer`), {
    sdp: offer.sdp,
    type: offer.type,
    timestamp: Date.now()
  });
  console.log('✅ Offer sent to Firebase');

  // ICE candidate gönder
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      push(ref(db, `calls/${roomId}/candidates/caller`), event.candidate.toJSON());
    }
  };

  // Answer'ı dinle
  onValue(ref(db, `calls/${roomId}/answer`), async (snapshot) => {
    const answer = snapshot.val();
    if (answer && !pc.currentRemoteDescription) {
      console.log('Received answer, setting remote description...');
      const remoteDesc = new RTCSessionDescription(answer);
      await pc.setRemoteDescription(remoteDesc);
    }
  });

  // Karşı tarafın candidate'larını dinle
  onChildAdded(ref(db, `calls/${roomId}/candidates/callee`), async (snapshot) => {
    const candidate = new RTCIceCandidate(snapshot.val());
    await pc.addIceCandidate(candidate);
  });

  return pc;
}

export async function answerCall(roomId: string, localStream: MediaStream, remoteElement: HTMLVideoElement | HTMLAudioElement) {
  const pc = createPeerConnection((event) => {
    console.log('Received remote track:', event.track.kind);
    const remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    remoteElement.srcObject = remoteStream;
    remoteElement.play().catch(e => console.log('Remote media play failed:', e));
  });

  // Local stream ekle
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
  });

  // ICE candidate gönder
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      push(ref(db, `calls/${roomId}/candidates/callee`), event.candidate.toJSON());
    }
  };

  // Offer'ı dinle ve answer oluştur
  onValue(ref(db, `calls/${roomId}/offer`), async (snapshot) => {
    const offer = snapshot.val();
    if (offer && !pc.currentRemoteDescription) {
      console.log('Received offer, creating answer...');
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Answer'ı Firebase'e yaz
      await set(ref(db, `calls/${roomId}/answer`), {
        sdp: answer.sdp,
        type: answer.type,
      });
    }
  });

  // Karşı tarafın candidate'larını dinle
  onChildAdded(ref(db, `calls/${roomId}/candidates/caller`), async (snapshot) => {
    const candidate = new RTCIceCandidate(snapshot.val());
    await pc.addIceCandidate(candidate);
  });

  return pc;
}

export async function endCall(roomId: string, peerConnection: RTCPeerConnection) {
  // Peer connection'ı kapat
  peerConnection.close();

  // Firebase'deki call data'yı temizle
  await set(ref(db, `calls/${roomId}`), null);
}

export function listenForCall(roomId: string, localStream: MediaStream, remoteElement: HTMLVideoElement | HTMLAudioElement): RTCPeerConnection {
  console.log('👂 Starting to listen for calls in room:', roomId);

  const pc = createPeerConnection((event) => {
    console.log('📡 Received remote track:', event.track.kind);
    const remoteStream = new MediaStream();
    remoteStream.addTrack(event.track);
    remoteElement.srcObject = remoteStream;
    remoteElement.play().catch(e => console.log('Remote media play failed:', e));
  });

  console.log('🎤 Adding local tracks for listener:', localStream.getTracks().length);
  localStream.getTracks().forEach((track) => {
    console.log('Adding track:', track.kind, track.enabled);
    pc.addTrack(track, localStream);
  });

  // Offer'ı dinle
  console.log('🔥 Setting up Firebase listener for offers...');
  onValue(ref(db, `calls/${roomId}/offer`), async (snapshot) => {
    const offer = snapshot.val();
    console.log('📨 Offer received:', offer ? 'YES' : 'NO');

    if (offer && !pc.currentRemoteDescription) {
      console.log('✅ Processing offer, creating answer...');
      console.log('Offer details:', { type: offer.type, sdp: offer.sdp?.substring(0, 50) + '...' });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Remote description set');

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('✅ Local description (answer) set');

      // Answer'ı Firebase'e yaz
      console.log('🔥 Sending answer to Firebase...');
      await set(ref(db, `calls/${roomId}/answer`), {
        type: answer.type,
        sdp: answer.sdp,
        timestamp: Date.now()
      });
      console.log('✅ Answer sent to Firebase');
    } else if (offer && pc.currentRemoteDescription) {
      console.log('⚠️ Offer received but remote description already set');
    }
  });

  // ICE candidate gönder
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('Sending ICE candidate (callee)');
      push(ref(db, `calls/${roomId}/candidates/callee`), event.candidate.toJSON());
    }
  };

  // Karşı tarafın candidate'larını dinle
  onChildAdded(ref(db, `calls/${roomId}/candidates/caller`), async (snapshot) => {
    const candidate = new RTCIceCandidate(snapshot.val());
    console.log('Adding remote ICE candidate (from caller)');
    await pc.addIceCandidate(candidate);
  });

  return pc;
}

export async function getUserMedia(constraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
}): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got local stream with tracks:', stream.getTracks().map(t => t.kind));
    return stream;
  } catch (error) {
    console.error('Error getting user media:', error);
    throw error;
  }
}

// Video call için getUserMedia
export async function getUserMediaWithVideo(constraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user'
  }
}): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Got local video stream with tracks:', stream.getTracks().map(t => t.kind));
    return stream;
  } catch (error) {
    console.error('Error getting user media with video:', error);
    throw error;
  }
}
