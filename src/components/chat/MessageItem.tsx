import { useState, type FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar } from "../common/Avatar";
import { formatDateTime } from "../../lib/time";
import { MESSAGE_MAX_CHARS } from "../../lib/constants";

// Source-agnostic message shape (works for channel messages and DMs).
export interface ChatMessage {
  _id: string;
  _creationTime: number;
  authorId: Id<"users">;
  content: string;
  editedAt?: number;
  authorName?: string;
  authorImage?: string;
}

/**
 * A single message row (FR-017). Edit/delete are provided by the parent so the same
 * component serves channel messages and DMs (FR-018/FR-022).
 */
export function MessageItem({
  message,
  isOwn,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  isOwn: boolean;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    await onEdit(content);
    setEditing(false);
  }

  async function onDeleteClick() {
    if (!window.confirm("Delete this message?")) return;
    await onDelete();
  }

  return (
    <div className="group flex gap-3 px-4 py-1.5 hover:bg-elevated/40">
      <div className="pt-0.5">
        <Avatar name={message.authorName} image={message.authorImage} size={38} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-normal">
            {message.authorName ?? "Unknown"}
          </span>
          <span className="text-xs text-text-muted">
            {formatDateTime(message._creationTime)}
          </span>
          {message.editedAt !== undefined && (
            <span className="text-xs text-text-muted">(edited)</span>
          )}
        </div>

        {editing ? (
          <form onSubmit={onSaveEdit} className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MESSAGE_MAX_CHARS}
              rows={2}
              className="w-full resize-none rounded bg-rail px-3 py-2 text-sm text-text-normal outline-none ring-accent focus:ring-2"
              autoFocus
            />
            <div className="mt-1 flex gap-2 text-xs text-text-muted">
              <button type="submit" className="text-accent hover:underline">
                Save
              </button>
              <button
                type="button"
                className="hover:underline"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-text-normal">
            {message.content}
          </p>
        )}
      </div>

      {isOwn && !editing && (
        // Kept in the tab order (not display:none) so keyboard users can reach
        // these via focus, not just pointer hover — same fix as ChannelSidebar
        // and MemberList's hover-reveal actions.
        <div className="flex gap-2 text-xs text-text-muted opacity-0 focus-within:opacity-100 group-hover:opacity-100">
          <button
            className="hover:text-text-normal"
            onClick={() => setEditing(true)}
            aria-label="Edit message"
          >
            Edit
          </button>
          <button
            className="hover:text-danger"
            onClick={onDeleteClick}
            aria-label="Delete message"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
