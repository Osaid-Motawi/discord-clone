// Speaking detection (research.md §7a). Remote levels come from PeerMesh's
// `getRemoteAudioLevel` (RTCRtpReceiver.getSynchronizationSources); the local level
// uses a Web Audio AnalyserNode, since there's no RTCRtpReceiver for one's own mic.

export const SPEAKING_THRESHOLD = 0.02; // empirical RMS threshold, 0..1 scale

/** RMS-based local microphone level via an AnalyserNode. */
export class LocalSpeakingMeter {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private data: Uint8Array<ArrayBuffer> | null = null;

  start(stream: MediaStream): void {
    this.stop();
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    const source = this.ctx.createMediaStreamSource(stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    source.connect(this.analyser);
  }

  /** Current RMS level in [0, 1]; 0 if not started. */
  level(): number {
    if (!this.analyser || !this.data) return 0;
    this.analyser.getByteTimeDomainData(this.data);
    let sumSquares = 0;
    for (const byte of this.data) {
      const normalized = (byte - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / this.data.length);
  }

  stop(): void {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.analyser = null;
    this.data = null;
  }
}
