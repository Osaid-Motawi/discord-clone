// Full-mesh WebRTC peer management using the Perfect Negotiation pattern
// (research.md §7a). Framework-free and unit-testable (Constitution Principle VI) —
// the RTCPeerConnection constructor is injectable so tests can supply a mock.

export type SignalKind = "offer" | "answer" | "candidate";

export interface OutgoingSignal {
  toUserId: string;
  kind: SignalKind;
  payload: string;
}

export interface PeerMeshEvents {
  onSignal?: (signal: OutgoingSignal) => void;
  onTrack?: (peerId: string, stream: MediaStream) => void;
  onConnectionStateChange?: (
    peerId: string,
    state: RTCPeerConnectionState,
  ) => void;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

interface PeerState {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
}

type RTCPeerConnectionCtor = new (
  config?: RTCConfiguration,
) => RTCPeerConnection;

/**
 * Manages one RTCPeerConnection per remote participant (≤3 for a 4-peer mesh).
 * Both sides run identical negotiation code; `polite` is derived deterministically
 * per pair from user id comparison, so exactly one side rolls back on collision.
 */
export class PeerMesh {
  private peers = new Map<string, PeerState>();
  private localStream: MediaStream | null = null;

  constructor(
    private readonly myUserId: string,
    private readonly events: PeerMeshEvents,
    private readonly rtcPeerConnectionCtor: RTCPeerConnectionCtor = globalThis.RTCPeerConnection,
  ) {}

  /** Attach (or clear) local media. Tolerates `null` for a listen-only join. */
  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  getPeerIds(): string[] {
    return [...this.peers.keys()];
  }

  /** Create a connection to a newly-seen roster member. */
  addPeer(peerId: string): void {
    if (this.peers.has(peerId) || peerId === this.myUserId) return;

    const pc = new this.rtcPeerConnectionCtor({ iceServers: ICE_SERVERS });
    const polite = this.myUserId < peerId;
    const state: PeerState = {
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
    };
    this.peers.set(peerId, state);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      // Listen-only join: still negotiate so we can receive the remote's media.
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
    }

    pc.onnegotiationneeded = async () => {
      try {
        state.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.events.onSignal?.({
            toUserId: peerId,
            kind: pc.localDescription.type as SignalKind,
            payload: JSON.stringify(pc.localDescription),
          });
        }
      } catch (err) {
        console.error(`[PeerMesh] negotiationneeded failed for ${peerId}`, err);
      } finally {
        state.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.events.onSignal?.({
          toUserId: peerId,
          kind: "candidate",
          payload: JSON.stringify(candidate),
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.events.onTrack?.(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange?.(peerId, pc.connectionState);
      if (pc.connectionState === "failed") {
        pc.restartIce();
      }
    };
  }

  /** Tear down and forget a peer (they left the roster). */
  removePeer(peerId: string): void {
    const state = this.peers.get(peerId);
    if (!state) return;
    state.pc.close();
    this.peers.delete(peerId);
  }

  closeAll(): void {
    for (const peerId of this.getPeerIds()) this.removePeer(peerId);
  }

  /** Apply an incoming SDP offer/answer using the Perfect Negotiation algorithm. */
  async handleDescription(
    peerId: string,
    description: RTCSessionDescriptionInit,
  ): Promise<void> {
    const state = this.peers.get(peerId);
    if (!state) return;
    const { pc } = state;

    const readyForOffer =
      !state.makingOffer &&
      (pc.signalingState === "stable" || state.isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;

    state.ignoreOffer = !state.polite && offerCollision;
    if (state.ignoreOffer) return;

    state.isSettingRemoteAnswerPending = description.type === "answer";
    await pc.setRemoteDescription(description);
    state.isSettingRemoteAnswerPending = false;

    if (state.pendingCandidates.length > 0) {
      const queued = state.pendingCandidates;
      state.pendingCandidates = [];
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.error(`[PeerMesh] queued addIceCandidate failed for ${peerId}`, err);
        }
      }
    }

    if (description.type === "offer") {
      await pc.setLocalDescription();
      if (pc.localDescription) {
        this.events.onSignal?.({
          toUserId: peerId,
          kind: "answer",
          payload: JSON.stringify(pc.localDescription),
        });
      }
    }
  }

  /** Apply an incoming ICE candidate, buffering until a remote description exists. */
  async handleCandidate(
    peerId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const state = this.peers.get(peerId);
    if (!state) return;
    const { pc } = state;

    if (pc.remoteDescription === null) {
      state.pendingCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!state.ignoreOffer) {
        console.error(`[PeerMesh] addIceCandidate failed for ${peerId}`, err);
      }
    }
  }

  /** Toggle the local microphone via `track.enabled` (no renegotiation). */
  setMicEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  /** Toggle the local camera via `track.enabled` (no renegotiation). */
  setCameraEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
  }

  /**
   * @internal Test-only introspection of a peer's negotiation state (Constitution
   * Principle VI — testable seam for the Perfect Negotiation glare scenario).
   */
  debugPeerState(
    peerId: string,
  ): Pick<PeerState, "polite" | "makingOffer" | "ignoreOffer"> | null {
    const state = this.peers.get(peerId);
    if (!state) return null;
    const { polite, makingOffer, ignoreOffer } = state;
    return { polite, makingOffer, ignoreOffer };
  }

  /** Max remote audio level for a peer via getSynchronizationSources (research.md §7a). */
  getRemoteAudioLevel(peerId: string): number {
    const state = this.peers.get(peerId);
    if (!state) return 0;
    let max = 0;
    for (const receiver of state.pc.getReceivers()) {
      if (receiver.track.kind !== "audio") continue;
      if (typeof receiver.getSynchronizationSources !== "function") continue;
      for (const source of receiver.getSynchronizationSources()) {
        if (typeof source.audioLevel === "number" && source.audioLevel > max) {
          max = source.audioLevel;
        }
      }
    }
    return max;
  }
}
