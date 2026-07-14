import { useEffect, useRef, useState } from "react";
import { Avatar } from "../common/Avatar";
import type { CallParticipantView } from "../../hooks/useCall";

const DISCONNECTED_DEBOUNCE_MS = 3000;

/** One participant's tile: video (if camera on) or avatar, with mic/speaking state. */
export function VideoTile({ participant }: { participant: CallParticipantView }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = participant.cameraEnabled && participant.stream !== null;
  const [showIssue, setShowIssue] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  // "failed" is surfaced immediately; "disconnected" is often transient (a brief
  // network blip), so it's debounced before showing anything (research.md §7a).
  useEffect(() => {
    if (participant.isSelf) return;
    if (participant.connectionState === "failed") {
      setShowIssue(true);
      return;
    }
    if (participant.connectionState === "disconnected") {
      const id = window.setTimeout(
        () => setShowIssue(true),
        DISCONNECTED_DEBOUNCE_MS,
      );
      return () => window.clearTimeout(id);
    }
    setShowIssue(false);
  }, [participant.connectionState, participant.isSelf]);

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-rail ${
        participant.speaking ? "ring-2 ring-online" : ""
      }`}
    >
      {/*
        Always mounted whenever a stream exists — this is the only element that
        plays the participant's AUDIO, so it must stay in the DOM regardless of
        camera state. Previously this only rendered when the camera was on,
        which meant no audio played at all while a camera was off (the default
        state for every participant on join) — a real bug, not just a visual one.
        The video layer is visually hidden (not unmounted) when the camera is
        off; the avatar renders on top as an opaque layer in that case.
      */}
      {participant.stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isSelf}
          className={`absolute inset-0 h-full w-full object-cover ${
            showVideo ? "" : "opacity-0"
          }`}
        />
      )}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-rail">
          <Avatar name={participant.name} image={participant.image} size={64} />
        </div>
      )}

      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {!participant.micEnabled && <span aria-label="Muted">🔇</span>}
        <span>
          {participant.name ?? "Unknown"}
          {participant.isSelf && " (you)"}
        </span>
      </div>

      {showIssue && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/80 p-2 text-center"
          role="alert"
          title="No relay (TURN) server is configured in v1 — strict NATs or firewalls can block a direct connection."
        >
          <span className="text-xs font-medium text-danger">
            ⚠️ Couldn't connect to {participant.name ?? "this participant"}
          </span>
          <span className="text-xs text-text-muted">
            Possibly a restrictive network or firewall (no relay server in v1).
          </span>
        </div>
      )}
    </div>
  );
}
