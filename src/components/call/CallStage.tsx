import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useCall, type CallJoinArgs } from "../../hooks/useCall";
import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";
import { EmptyState } from "../common/EmptyState";
import { Spinner } from "../common/Spinner";

/**
 * A live call surface: joins on mount, leaves on unmount (FR-024, FR-028), shows a
 * video-tile grid for up to 4 participants (FR-025, FR-027), and in-call controls.
 */
export function CallStage({
  joinArgs,
  onLeave,
}: {
  joinArgs: CallJoinArgs;
  onLeave: () => void;
}) {
  const me = useQuery(api.users.me, {});
  const {
    callId,
    joinError,
    mediaDenied,
    cameraUnavailable,
    micEnabled,
    cameraEnabled,
    participants,
    toggleMic,
    toggleCamera,
  } = useCall(me?._id, joinArgs);

  if (joinError) {
    return <EmptyState title="Couldn't join the call">{joinError}</EmptyState>;
  }
  if (!callId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Joining call…" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-y-auto p-4">
        {participants.map((p) => (
          <VideoTile key={p.userId} participant={p} />
        ))}
      </div>
      <CallControls
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        mediaDenied={mediaDenied}
        cameraUnavailable={cameraUnavailable}
        onToggleMic={() => void toggleMic()}
        onToggleCamera={() => void toggleCamera()}
        onLeave={onLeave}
      />
    </div>
  );
}
