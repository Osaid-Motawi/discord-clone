import { useEffect, useRef } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { MessageItem, type ChatMessage } from "./MessageItem";
import { EmptyState } from "../common/EmptyState";
import { MESSAGE_PAGE_SIZE } from "../../lib/constants";

type Status = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";

/**
 * Presentational, scrollable message history with newest-first infinite scroll
 * (FR-016, FR-019). Data + edit/delete come from the parent, so it serves both
 * channel messages and DMs.
 */
export function MessageListView({
  messages,
  status,
  loadMore,
  meId,
  onEdit,
  onDelete,
}: {
  messages: ChatMessage[];
  status: Status;
  loadMore: (n: number) => void;
  meId: Id<"users"> | undefined;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

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
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-3">
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
          isOwn={message.authorId === meId}
          onEdit={(content) => onEdit(message._id, content)}
          onDelete={() => onDelete(message._id)}
        />
      ))}
    </div>
  );
}
