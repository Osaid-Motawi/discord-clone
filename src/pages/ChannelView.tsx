import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MessageListView } from "../components/chat/MessageList";
import { Composer } from "../components/chat/Composer";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { CallStage } from "../components/call/CallStage";
import { Button } from "../components/common/Button";
import { Avatar } from "../components/common/Avatar";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { useInfiniteMessages } from "../hooks/useInfiniteMessages";

/** A channel: text (message history + composer) or voice (join lobby + call). */
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
  if (channel === null) return <EmptyState title="Channel not found" />;
  if (channel.type === "voice") {
    return <VoiceChannelView channelId={typedChannelId} name={channel.name} />;
  }

  return <ChannelChat channelId={typedChannelId} name={channel.name} />;
}

function ChannelChat({
  channelId,
  name,
}: {
  channelId: Id<"channels">;
  name: string;
}) {
  const { messages, status, loadMore } = useInfiniteMessages(channelId);
  const me = useQuery(api.users.me, {});
  const send = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);

  return (
    <>
      <header className="flex h-12 items-center border-b border-rail px-4 font-semibold text-text-normal">
        <span className="text-text-muted">#</span>
        <span className="ml-1">{name}</span>
      </header>
      <MessageListView
        messages={messages}
        status={status}
        loadMore={loadMore}
        meId={me?._id}
        onEdit={async (messageId, content) => {
          await editMessage({ messageId: messageId as Id<"messages">, content });
        }}
        onDelete={async (messageId) => {
          await removeMessage({ messageId: messageId as Id<"messages"> });
        }}
      />
      <TypingIndicator scopeType="channel" scopeId={channelId} />
      <Composer
        onSend={async (content) => {
          await send({ channelId, content });
        }}
        scopeType="channel"
        scopeId={channelId}
        placeholder={`Message #${name}`}
      />
    </>
  );
}

/** Voice channel: a join lobby (with who's already connected), then the call stage. */
function VoiceChannelView({
  channelId,
  name,
}: {
  channelId: Id<"channels">;
  name: string;
}) {
  const [joined, setJoined] = useState(false);
  const channel = useQuery(api.channels.get, { channelId });
  const connected = useQuery(
    api.calls.connectedByChannel,
    channel ? { serverId: channel.serverId } : "skip",
  );
  const here = connected?.find((c) => c.channelId === channelId)?.participants ?? [];

  if (joined) {
    return (
      <>
        <header className="flex h-12 items-center border-b border-rail px-4 font-semibold text-text-normal">
          <span className="text-text-muted">🔊</span>
          <span className="ml-1">{name}</span>
        </header>
        <CallStage
          joinArgs={{ scopeType: "channel", channelId }}
          onLeave={() => setJoined(false)}
        />
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-4xl">🔊</div>
      <h2 className="text-lg font-semibold text-text-normal">{name}</h2>
      {here.length > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-text-muted">Currently in this channel:</p>
          <div className="flex gap-2">
            {here.map((p) => (
              <div key={p.userId} className="flex flex-col items-center gap-1">
                <Avatar name={p.name} size={40} />
                <span className="text-xs text-text-muted">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">No one's here yet.</p>
      )}
      <Button onClick={() => setJoined(true)}>Join Voice Channel</Button>
    </div>
  );
}
