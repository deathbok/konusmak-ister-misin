import { ref, push, set } from 'firebase/database';
import { db } from '@/lib/firebase';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export const defaultWebRTCConfig: WebRTCConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }, // STUN server
  ],
};

// Factory function for creating peer connections
export function createPeerConnection(onTrackCallback?: (event: RTCTrackEvent) => void): RTCPeerConnection {
  const config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }, // STUN server
    ],
  };

  const pc = new RTCPeerConnection(config);

  if (onTrackCallback) {
    pc.ontrack = onTrackCallback;
  }

  return pc;
}

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private roomId: string;
  private userId: string;
  private userRole: string;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateCallback?: (state: RTCPeerConnectionState) => void;

  constructor(roomId: string, userId: string, userRole?: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.userRole = userRole || userId;
  }

  // Initialize peer connection
  initializePeerConnection(): RTCPeerConnection {
    // Use factory function with ontrack callback
    const pc = createPeerConnection((event) => {
      console.log('Received remote track:', event.track.kind);
      const remoteStream = new MediaStream();
      remoteStream.addTrack(event.track);
      this.remoteStream = remoteStream;

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteStream);
      }
    });

    pc.onicecandidate = event => {
      if (event.candidate) {
        console.log('Sending ICE candidate:', event.candidate);
        const candidateRef = ref(db, `calls/${this.roomId}/candidates/${this.userRole}_user`);
        push(candidateRef, event.candidate.toJSON());
      } else {
        console.log('ICE gathering completed');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    this.peerConnection = pc;
    return pc;
  }

  // Get user media
  async getUserMedia(constraints: MediaStreamConstraints = { 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    } 
  }): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      console.log('Got local stream');
      return stream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw error;
    }
  }

  // Add local stream to peer connection
  addLocalStream(stream: MediaStream): void {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    console.log('Adding tracks to peer connection:', stream.getTracks().length);
    stream.getTracks().forEach(track => this.peerConnection!.addTrack(track, stream));
  }

  // Create and send offer
  createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('Creating offer...');
    return this.peerConnection.createOffer({
      offerToReceiveAudio: true
    }).then(offer => {
      console.log('Offer created, setting local description...');
      return this.peerConnection!.setLocalDescription(offer);
    }).then(() => {
      console.log('Local description set');
      // Firebase'e offer'ı yaz
      const offerRef = ref(db, `calls/${this.roomId}/offer`);
      return set(offerRef, {
        sdp: this.peerConnection!.localDescription!.sdp,
        type: this.peerConnection!.localDescription!.type,
        from: this.userId,
        timestamp: Date.now()
      });
    }).then(() => {
      console.log('Offer sent to Firebase');
      return this.peerConnection!.localDescription!;
    });
  }

  // Create and send answer
  createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('Setting remote description...');
    return this.peerConnection.setRemoteDescription(offer).then(() => {
      console.log('Remote description set, creating answer...');
      return this.peerConnection!.createAnswer();
    }).then(answer => {
      console.log('Answer created, setting local description...');
      return this.peerConnection!.setLocalDescription(answer);
    }).then(() => {
      console.log('Local description set (answer)');
      // Firebase'e answer'ı yaz
      const answerRef = ref(db, `calls/${this.roomId}/answer`);
      return set(answerRef, {
        sdp: this.peerConnection!.localDescription!.sdp,
        type: this.peerConnection!.localDescription!.type,
        from: this.userId,
        timestamp: Date.now()
      });
    }).then(() => {
      console.log('Answer sent to Firebase');
      return this.peerConnection!.localDescription!;
    });
  }

  // Handle remote answer
  handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    console.log('Setting remote description with answer');
    return this.peerConnection.setRemoteDescription(answer).then(() => {
      console.log('Answer received and set');
    });
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      console.log('Adding remote ICE candidate:', candidate);
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
      throw error;
    }
  }

  // Clean up resources
  cleanup(): void {
    console.log('Cleaning up WebRTC resources');

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear remote stream
    this.remoteStream = null;

    // Clear Firebase data
    const callRef = ref(db, `calls/${this.roomId}`);
    set(callRef, null);
  }

  // Getters
  getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // Event callbacks
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionState(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }
}

// Utility functions
export const clearCall = async (roomId: string): Promise<void> => {
  const callRef = ref(db, `calls/${roomId}`);
  await set(callRef, null);
};

// Standalone utility functions
export async function createOffer(peerConnection: RTCPeerConnection, roomId: string, userId: string): Promise<RTCSessionDescriptionInit> {
  console.log('Creating offer...');
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true
  });
  await peerConnection.setLocalDescription(offer);
  console.log('Local description set');

  // Firebase'e offer'ı yaz
  const offerRef = ref(db, `calls/${roomId}/offer`);
  await set(offerRef, {
    sdp: offer.sdp,
    type: offer.type,
    from: userId,
    timestamp: Date.now()
  });

  console.log('Offer sent to Firebase');
  return offer;
}

export async function createAnswer(peerConnection: RTCPeerConnection, offer: RTCSessionDescriptionInit, roomId: string, userId: string): Promise<RTCSessionDescriptionInit> {
  console.log('Setting remote description...');
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  console.log('Creating answer...');
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  console.log('Local description set (answer)');

  // Firebase'e answer'ı yaz
  const answerRef = ref(db, `calls/${roomId}/answer`);
  await set(answerRef, {
    sdp: answer.sdp,
    type: answer.type,
    from: userId,
    timestamp: Date.now()
  });

  console.log('Answer sent to Firebase');
  return answer;
}

export const createWebRTCManager = (roomId: string, userId: string, userRole?: string): WebRTCManager => {
  return new WebRTCManager(roomId, userId, userRole);
};
