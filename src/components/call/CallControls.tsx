import { Button } from "../common/Button";

/** Mic/camera toggles + leave (FR-026, FR-028). */
export function CallControls({
  micEnabled,
  cameraEnabled,
  mediaDenied,
  cameraUnavailable,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: {
  micEnabled: boolean;
  cameraEnabled: boolean;
  mediaDenied: boolean;
  cameraUnavailable: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-rail bg-sidebar px-4 py-3">
      {mediaDenied && (
        <span className="text-xs text-text-muted">
          No camera/mic access — you're listening only.
        </span>
      )}
      {!mediaDenied && cameraUnavailable && (
        <span className="text-xs text-text-muted">
          No camera available (denied, missing, or in use elsewhere) — audio only.
        </span>
      )}
      <Button
        variant={micEnabled ? "secondary" : "danger"}
        onClick={onToggleMic}
        disabled={mediaDenied}
        aria-pressed={micEnabled}
        title={micEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {micEnabled ? "🎙️ Mute" : "🔇 Unmute"}
      </Button>
      <Button
        variant={cameraEnabled ? "secondary" : "danger"}
        onClick={onToggleCamera}
        disabled={mediaDenied || cameraUnavailable}
        aria-pressed={cameraEnabled}
        title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
      >
        {cameraEnabled ? "📷 Stop Video" : "📷 Start Video"}
      </Button>
      <Button variant="danger" onClick={onLeave}>
        Leave
      </Button>
    </div>
  );
}
