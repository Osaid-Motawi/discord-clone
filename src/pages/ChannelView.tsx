import { useQuery } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MessageList } from "../components/chat/MessageList";
import { Composer } from "../components/chat/Composer";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";

/** A text channel: header, live message history, typing indicator, composer. */
export function ChannelView() {
  const { channelId } = useParams();
  const typedChannelId = channelId as Id<"channels"> | undefined;
  const channel = useQuery(
    api.channels.get,
    typedChannelId ? { channelId: typedChannelId } : "skip",
  );

  if (!typedChannelId || channel === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading channel…" />
      </div>
    );
  }
  if (channel === null) {
    return <EmptyState title="Channel not found" />;
  }
  if (channel.type !== "text") {
    return (
      <EmptyState title={`🔊 ${channel.name}`}>
        Voice channels arrive in User Story 6.
      </EmptyState>
    );
  }

  return (
    <>
      <header className="flex h-12 items-center border-b border-rail px-4 font-semibold text-text-normal">
        <span className="text-text-muted">#</span>
        <span className="ml-1">{channel.name}</span>
      </header>
      <MessageList channelId={typedChannelId} />
      <TypingIndicator scopeType="channel" scopeId={typedChannelId} />
      <Composer channelId={typedChannelId} placeholder={`Message #${channel.name}`} />
    </>
  );
}
