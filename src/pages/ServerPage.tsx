import { useQuery } from "convex/react";
import { useParams, Navigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";

/** Server landing: redirect into the default (or first) text channel (US3). */
export function ServerPage() {
  const { serverId } = useParams();
  const typedServerId = serverId as Id<"servers"> | undefined;
  const channels = useQuery(
    api.channels.list,
    typedServerId ? { serverId: typedServerId } : "skip",
  );

  if (channels === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading channels…" />
      </div>
    );
  }

  const textChannels = channels.filter((c) => c.type === "text");
  const target =
    textChannels.find((c) => c.isDefault) ?? textChannels[0] ?? null;

  if (target) {
    return (
      <Navigate
        to={`/servers/${typedServerId}/channels/${target._id}`}
        replace
      />
    );
  }

  return (
    <EmptyState title="No text channels">
      This server has no text channels yet.
    </EmptyState>
  );
}
