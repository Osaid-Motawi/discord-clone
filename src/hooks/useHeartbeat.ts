import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PRESENCE_HEARTBEAT_MS } from "../lib/presence";

/**
 * Sends a presence heartbeat on an interval and on focus/visibility changes while
 * the user is connected (FR-003). Reads stay reactive; this is a write cadence only.
 */
export function useHeartbeat() {
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    const beat = () => {
      void heartbeat({});
    };
    beat();
    const id = window.setInterval(beat, PRESENCE_HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", beat);
    };
  }, [heartbeat]);
}
