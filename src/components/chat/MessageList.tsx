import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useInfiniteMessages } from "../../hooks/useInfiniteMessages";
import { MessageItem } from "./MessageItem";
import { EmptyState } from "../common/EmptyState";
import { MESSAGE_PAGE_SIZE } from "../../lib/constants";

/** Scrollable message history with newest-first infinite scroll (FR-016, FR-019). */
export function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const { messages, status, loadMore } = useInfiniteMessages(channelId);
  const me = useQuery(api.users.me, {});
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Auto-scroll to the bottom when a new latest message arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const latest = messages[messages.length - 1]?._id ?? null;
    if (latest !== lastIdRef.current) {
      lastIdRef.current = latest;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 48 && status === "CanLoadMore") {
      loadMore(MESSAGE_PAGE_SIZE);
    }
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto py-3"
    >
      {status === "LoadingMore" && (
        <p className="py-2 text-center text-xs text-text-muted">Loading older…</p>
      )}
      {status === "Exhausted" && messages.length === 0 && (
        <EmptyState title="No messages yet">
          Be the first to say something.
        </EmptyState>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message._id}
          message={message}
          isOwn={message.authorId === me?._id}
        />
      ))}
    </div>
  );
}
