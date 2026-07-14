import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MessageListView } from "../components/chat/MessageList";
import { Composer } from "../components/chat/Composer";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { CallStage } from "../components/call/CallStage";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { Spinner } from "../components/common/Spinner";
import { Avatar } from "../components/common/Avatar";
import { useInfiniteDMMessages } from "../hooks/useInfiniteDMMessages";

/** A 1-on-1 DM conversation: header, live history, typing indicator, composer (FR-022). */
export function DMPage() {
  const { threadId } = useParams();
  const typedThreadId = threadId as Id<"directMessageThreads"> | undefined;
  const thread = useQuery(
    api.directMessages.getThread,
    typedThreadId ? { threadId: typedThreadId } : "skip",
  );

  if (!typedThreadId || thread === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label="Loading conversation…" />
      </div>
    );
  }
  if (thread === null) return <EmptyState title="Conversation not found" />;

  return <DMChat threadId={typedThreadId} other={thread.otherUser} />;
}

function DMChat({
  threadId,
  other,
}: {
  threadId: Id<"directMessageThreads">;
  other: { name?: string; image?: string };
}) {
  const { messages, status, loadMore } = useInfiniteDMMessages(threadId);
  const me = useQuery(api.users.me, {});
  const send = useMutation(api.directMessages.send);
  const editMessage = useMutation(api.directMessages.edit);
  const removeMessage = useMutation(api.directMessages.remove);
  const markRead = useMutation(api.directMessages.markRead);

  // Mark the thread read on open, and again whenever a new message arrives
  // while it's open (FR-023a) — otherwise the badge would only clear on the
  // *next* visit, not while actively viewing the conversation.
  useEffect(() => {
    void markRead({ threadId });
  }, [threadId, messages.length, markRead]);

  // Reactive: flips to non-null the instant the other participant starts a call
  // (FR-030, US7 #1) — no separate "incoming call" notification system needed.
  const activeCall = useQuery(api.calls.activeForThread, { threadId });
  const [inCall, setInCall] = useState(false);

  const name = other.name ?? "Unknown";

  return (
    <>
      <header className="flex h-12 items-center justify-between gap-2 border-b border-rail px-4 font-semibold text-text-normal">
        <div className="flex items-center gap-2">
          <Avatar name={other.name} image={other.image} size={24} />
          <span>{name}</span>
        </div>
        {!inCall && (
          <Button className="px-3 py-1 text-xs" onClick={() => setInCall(true)}>
            {activeCall ? "🎥 Join Video Call" : "🎥 Start Video Call"}
          </Button>
        )}
      </header>

      {inCall && (
        <div className="h-80 shrink-0 border-b border-rail">
          <CallStage
            joinArgs={{ scopeType: "dm", threadId }}
            onLeave={() => setInCall(false)}
          />
        </div>
      )}

      <MessageListView
        messages={messages}
        status={status}
        loadMore={loadMore}
        meId={me?._id}
        onEdit={async (messageId, content) => {
          await editMessage({
            messageId: messageId as Id<"directMessages">,
            content,
          });
        }}
        onDelete={async (messageId) => {
          await removeMessage({ messageId: messageId as Id<"directMessages"> });
        }}
      />
      <TypingIndicator scopeType="dm" scopeId={threadId} />
      <Composer
        onSend={async (content) => {
          await send({ threadId, content });
        }}
        scopeType="dm"
        scopeId={threadId}
        placeholder={`Message ${name}`}
      />
    </>
  );
}
