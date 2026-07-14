import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar } from "../common/Avatar";
import { formatDateTime } from "../../lib/time";
import { MESSAGE_MAX_CHARS } from "../../lib/constants";

export interface ChatMessage {
  _id: Id<"messages">;
  _creationTime: number;
  authorId: Id<"users">;
  content: string;
  editedAt?: number;
  authorName?: string;
  authorImage?: string;
}

/** A single message row with author-only edit/delete (FR-017, FR-018). */
export function MessageItem({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    await editMessage({ messageId: message._id, content });
    setEditing(false);
  }

  async function onDelete() {
    if (!window.confirm("Delete this message?")) return;
    await removeMessage({ messageId: message._id });
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
        <div className="hidden gap-2 text-xs text-text-muted group-hover:flex">
          <button className="hover:text-text-normal" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="hover:text-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
