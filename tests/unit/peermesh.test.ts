import { describe, it, expect } from "vitest";
import { PeerMesh, type OutgoingSignal } from "../../src/lib/webrtc/PeerMesh";

// A minimal stand-in for RTCPeerConnection sufficient to drive PeerMesh's
// negotiation logic deterministically, without a real browser (Constitution VI).
class MockRTCPeerConnection {
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((ev: { candidate: RTCIceCandidate | null }) => void) | null =
    null;
  ontrack: ((ev: { streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;

  signalingState: RTCSignalingState = "stable";
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  connectionState: RTCPeerConnectionState = "new";

  restartIceCallCount = 0;
  addIceCandidateCalls: unknown[] = [];
  closed = false;

  constructor(_config?: RTCConfiguration) {
    void _config;
  }

  addTrack(_track: unknown, _stream: unknown) {
    void _track;
    void _stream;
    this.scheduleNegotiation();
    return {};
  }

  addTransceiver(_kind: string, _init?: unknown) {
    void _kind;
    void _init;
    this.scheduleNegotiation();
    return {};
  }

  private negotiationScheduled = false;

  private scheduleNegotiation() {
    // Real browsers coalesce multiple synchronous triggers (e.g. addTransceiver
    // for audio + video) into a single negotiationneeded firing; mirror that.
    if (this.negotiationScheduled) return;
    this.negotiationScheduled = true;
    queueMicrotask(() => {
      this.negotiationScheduled = false;
      this.onnegotiationneeded?.();
    });
  }

  async setLocalDescription(desc?: RTCSessionDescriptionInit): Promise<void> {
    if (desc) {
      this.localDescription = desc;
    } else if (
      this.remoteDescription?.type === "offer" &&
      this.signalingState === "have-remote-offer"
    ) {
      this.localDescription = { type: "answer", sdp: `answer-${Math.random()}` };
    } else {
      this.localDescription = { type: "offer", sdp: `offer-${Math.random()}` };
    }
    this.signalingState =
      this.localDescription.type === "offer" ? "have-local-offer" : "stable";
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    // Implicit rollback: an incoming offer discards our own pending local offer.
    if (desc.type === "offer" && this.localDescription?.type === "offer") {
      this.localDescription = null;
    }
    this.remoteDescription = desc;
    this.signalingState = desc.type === "offer" ? "have-remote-offer" : "stable";
  }

  async addIceCandidate(candidate: unknown): Promise<void> {
    this.addIceCandidateCalls.push(candidate);
  }

  getReceivers() {
    return [];
  }

  restartIce() {
    this.restartIceCallCount++;
  }

  close() {
    this.closed = true;
  }
}

function flushMicrotasks(times = 4) {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => Promise.resolve());
  return p;
}

describe("PeerMesh — Perfect Negotiation", () => {
  it("resolves an offer/offer glare: impolite ignores, polite rolls back and answers", async () => {
    const polePcs: MockRTCPeerConnection[] = [];
    const remotePcs: MockRTCPeerConnection[] = [];

    const signalsFromA: OutgoingSignal[] = [];
    const signalsFromB: OutgoingSignal[] = [];

    // "aaa" < "bbb" lexicographically, so A is polite, B is impolite.
    const meshA = new PeerMesh(
      "aaa",
      { onSignal: (s) => signalsFromA.push(s) },
      class extends MockRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(config);
          polePcs.push(this);
        }
      } as unknown as new (config?: RTCConfiguration) => RTCPeerConnection,
    );
    const meshB = new PeerMesh(
      "bbb",
      { onSignal: (s) => signalsFromB.push(s) },
      class extends MockRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(config);
          remotePcs.push(this);
        }
      } as unknown as new (config?: RTCConfiguration) => RTCPeerConnection,
    );

    // Listen-only (no local stream) still triggers negotiation via addTransceiver.
    meshA.addPeer("bbb");
    meshB.addPeer("aaa");

    // Let both sides' negotiationneeded handlers run and produce their own offer
    // before either has seen the other's — this is the glare scenario.
    await flushMicrotasks();

    expect(signalsFromA).toHaveLength(1);
    expect(signalsFromA[0].kind).toBe("offer");
    expect(signalsFromB).toHaveLength(1);
    expect(signalsFromB[0].kind).toBe("offer");

    const bOffer = JSON.parse(signalsFromB[0].payload) as RTCSessionDescriptionInit;
    const aOffer = JSON.parse(signalsFromA[0].payload) as RTCSessionDescriptionInit;

    // Deliver each side's offer to the other, simulating simultaneous signaling.
    await meshA.handleDescription("bbb", bOffer);
    await meshB.handleDescription("aaa", aOffer);
    await flushMicrotasks();

    // Impolite (B) ignored A's offer — its own offer stands, unanswered.
    expect(meshB.debugPeerState("aaa")?.ignoreOffer).toBe(true);
    expect(remotePcs[0].localDescription?.type).toBe("offer");
    expect(remotePcs[0].remoteDescription).toBeNull();

    // Polite (A) rolled back and accepted B's offer, replying with an answer.
    expect(meshA.debugPeerState("bbb")?.ignoreOffer).toBe(false);
    expect(polePcs[0].remoteDescription?.type).toBe("offer");
    expect(polePcs[0].localDescription?.type).toBe("answer");
  });

  it("buffers ICE candidates until the remote description is set, then flushes them", async () => {
    const pcs: MockRTCPeerConnection[] = [];
    const mesh = new PeerMesh(
      "aaa",
      {},
      class extends MockRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(config);
          pcs.push(this);
        }
      } as unknown as new (config?: RTCConfiguration) => RTCPeerConnection,
    );
    mesh.addPeer("bbb");
    await flushMicrotasks();

    const candidate = { candidate: "fake", sdpMid: "0", sdpMLineIndex: 0 };

    // No remote description yet — candidate must be buffered, not applied.
    await mesh.handleCandidate("bbb", candidate);
    expect(pcs[0].addIceCandidateCalls).toHaveLength(0);

    // Once the remote description arrives, buffered candidates are flushed.
    await mesh.handleDescription("bbb", { type: "offer", sdp: "remote-offer" });
    expect(pcs[0].addIceCandidateCalls).toEqual([candidate]);

    // Subsequent candidates are applied immediately (no buffering needed).
    const candidate2 = { candidate: "fake2", sdpMid: "0", sdpMLineIndex: 0 };
    await mesh.handleCandidate("bbb", candidate2);
    expect(pcs[0].addIceCandidateCalls).toEqual([candidate, candidate2]);
  });

  it("calls restartIce when the connection state becomes 'failed'", async () => {
    const pcs: MockRTCPeerConnection[] = [];
    const mesh = new PeerMesh(
      "aaa",
      {},
      class extends MockRTCPeerConnection {
        constructor(config?: RTCConfiguration) {
          super(config);
          pcs.push(this);
        }
      } as unknown as new (config?: RTCConfiguration) => RTCPeerConnection,
    );
    mesh.addPeer("bbb");
    await flushMicrotasks();

    pcs[0].connectionState = "failed";
    pcs[0].onconnectionstatechange?.();

    expect(pcs[0].restartIceCallCount).toBe(1);
  });
});
