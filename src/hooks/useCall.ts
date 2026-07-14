import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PeerMesh } from "../lib/webrtc/PeerMesh";
import { processInboxSignals } from "../lib/webrtc/signaling";
import { LocalSpeakingMeter, SPEAKING_THRESHOLD } from "../lib/webrtc/speaking";
import { CALL_HEARTBEAT_MS, SPEAKING_POLL_MS } from "../lib/constants";

export interface CallJoinArgs {
  scopeType: "channel" | "dm";
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
}

export interface CallParticipantView {
  userId: Id<"users">;
  name?: string;
  image?: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  isSelf: boolean;
  stream: MediaStream | null;
  speaking: boolean;
  connectionState: RTCPeerConnectionState | "self";
}

/**
 * Joins a call for the given scope, drives the WebRTC mesh from Convex signals,
 * and exposes the live roster + media controls (FR-024–FR-032). Tolerates a
 * denied/unavailable camera or microphone by joining listen-only (edge case).
 */
export function useCall(
  meId: Id<"users"> | undefined,
  joinArgs: CallJoinArgs,
) {
  const join = useMutation(api.calls.join);
  const leave = useMutation(api.calls.leave);
  const heartbeat = useMutation(api.calls.heartbeat);
  const setMediaMutation = useMutation(api.calls.setMedia);
  const sendSignal = useMutation(api.signals.send);
  const ackSignal = useMutation(api.signals.ack);

  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [mediaDenied, setMediaDenied] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [micEnabled, setMicEnabledState] = useState(true);
  const [cameraEnabled, setCameraEnabledState] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>(
    {},
  );
  const [connectionStates, setConnectionStates] = useState<
    Record<string, RTCPeerConnectionState>
  >({});
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());

  const meshRef = useRef<PeerMesh | null>(null);
  const callIdRef = useRef<Id<"calls"> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localMeterRef = useRef(new LocalSpeakingMeter());
  const processedSignalIds = useRef<Set<string>>(new Set());

  const roster = useQuery(api.calls.roster, callId ? { callId } : "skip");
  const inbox = useQuery(api.signals.inbox, callId ? { callId } : "skip");

  const scopeKey = `${joinArgs.scopeType}:${
    joinArgs.channelId ?? joinArgs.threadId ?? ""
  }`;

  // Join + build the mesh once per call scope; leave + tear everything down on unmount.
  useEffect(() => {
    if (!meId) return;
    let cancelled = false;

    const mesh = new PeerMesh(meId, {
      onSignal: (signal) => {
        const currentCallId = callIdRef.current;
        if (!currentCallId) return;
        void sendSignal({
          callId: currentCallId,
          toUserId: signal.toUserId as Id<"users">,
          kind: signal.kind,
          payload: signal.payload,
        });
      },
      onTrack: (peerId, stream) => {
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      },
      onConnectionStateChange: (peerId, state) => {
        setConnectionStates((prev) => ({ ...prev, [peerId]: state }));
        if (state === "failed" || state === "closed") {
          setRemoteStreams((prev) => {
            if (!(peerId in prev)) return prev;
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
      },
    });
    meshRef.current = mesh;

    void (async () => {
      // Request mic + camera together first. If that fails — camera denied, no
      // camera present, or the device is busy (e.g. already held by another
      // tab) — a combined getUserMedia() call rejects entirely, which used to
      // take the microphone down with it. Retry audio-only so a camera problem
      // doesn't also silence the mic; only truly listen-only if audio fails too.
      let stream: MediaStream | null = null;
      let gotCamera = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        gotCamera = true;
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch {
          stream = null;
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        localStreamRef.current = stream;
        mesh.setLocalStream(stream);
        mesh.setCameraEnabled(false); // matches calls.join default (cameraEnabled:false)
        localMeterRef.current.start(stream);
        setMediaDenied(false);
        setCameraUnavailable(!gotCamera);
      } else {
        // Listen-only join (FR-026 edge case): no local media, still join the call.
        setMediaDenied(true);
      }

      try {
        const { callId: joinedCallId } = await join(joinArgs);
        if (cancelled) return;
        callIdRef.current = joinedCallId;
        setCallId(joinedCallId);
      } catch (err) {
        if (!cancelled) {
          setJoinError(
            err instanceof Error ? err.message : "Could not join the call.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      mesh.closeAll();
      meshRef.current = null;
      // ref holds a plain LocalSpeakingMeter instance (not a DOM node); reading it
      // in cleanup is safe — known false positive for non-DOM refs in this rule.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const meter = localMeterRef.current;
      meter.stop();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (callIdRef.current) {
        void leave({ callId: callIdRef.current });
      }
      callIdRef.current = null;
      setCallId(null);
      setRemoteStreams({});
      setConnectionStates({});
      setSpeakingIds(new Set());
      // ref holds a plain Set instance (not a DOM node); reading it in cleanup is
      // safe — known false positive for non-DOM refs in this rule.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const processed = processedSignalIds.current;
      processed.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, scopeKey]);

  // Heartbeat while connected (unexpected disconnects are swept server-side, FR-031).
  useEffect(() => {
    if (!callId) return;
    const id = window.setInterval(() => {
      void heartbeat({ callId });
    }, CALL_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [callId, heartbeat]);

  // Keep peer connections in sync with the reactive roster.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !roster) return;
    const otherIds = new Set(
      roster.map((p) => p.userId as string).filter((id) => id !== meId),
    );
    for (const peerId of otherIds) {
      if (!mesh.hasPeer(peerId)) mesh.addPeer(peerId);
    }
    for (const peerId of mesh.getPeerIds()) {
      if (!otherIds.has(peerId)) {
        mesh.removePeer(peerId);
        setRemoteStreams((prev) => {
          if (!(peerId in prev)) return prev;
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    }
  }, [roster, meId]);

  // Route incoming signals into the mesh, in order, deduped, then ack.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !inbox || inbox.length === 0) return;
    void processInboxSignals(
      inbox,
      mesh,
      processedSignalIds.current,
      (signalId) => {
        void ackSignal({ signalId: signalId as Id<"signals"> });
      },
    );
  }, [inbox, ackSignal]);

  // Poll speaking state for self + remote peers (research.md §7a).
  useEffect(() => {
    if (!callId) return;
    const id = window.setInterval(() => {
      const mesh = meshRef.current;
      const next = new Set<string>();
      if (meId && localMeterRef.current.level() > SPEAKING_THRESHOLD) {
        next.add(meId);
      }
      if (mesh) {
        for (const peerId of mesh.getPeerIds()) {
          if (mesh.getRemoteAudioLevel(peerId) > SPEAKING_THRESHOLD) {
            next.add(peerId);
          }
        }
      }
      setSpeakingIds(next);
    }, SPEAKING_POLL_MS);
    return () => window.clearInterval(id);
  }, [callId, meId]);

  async function toggleMic() {
    const next = !micEnabled;
    setMicEnabledState(next);
    meshRef.current?.setMicEnabled(next);
    if (callIdRef.current) {
      await setMediaMutation({ callId: callIdRef.current, micEnabled: next });
    }
  }

  async function toggleCamera() {
    if (cameraUnavailable) return; // no video track to enable (UI also disables this)
    const next = !cameraEnabled;
    setCameraEnabledState(next);
    meshRef.current?.setCameraEnabled(next);
    if (callIdRef.current) {
      await setMediaMutation({ callId: callIdRef.current, cameraEnabled: next });
    }
  }

  const participants: CallParticipantView[] = (roster ?? []).map((p) => {
    const isSelf = p.userId === meId;
    return {
      userId: p.userId,
      name: p.name,
      image: p.image,
      micEnabled: p.micEnabled,
      cameraEnabled: p.cameraEnabled,
      isSelf,
      stream: isSelf
        ? localStreamRef.current
        : (remoteStreams[p.userId] ?? null),
      speaking: speakingIds.has(p.userId),
      connectionState: isSelf ? "self" : (connectionStates[p.userId] ?? "new"),
    };
  });

  return {
    callId,
    joinError,
    mediaDenied,
    cameraUnavailable,
    micEnabled,
    cameraEnabled,
    participants,
    toggleMic,
    toggleCamera,
  };
}
