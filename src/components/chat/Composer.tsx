import { useRef, useState, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { MESSAGE_MAX_CHARS, TYPING_THROTTLE_MS } from "../../lib/constants";

/**
 * Message composer with typing pings and the 2000-char limit (FR-016/016a/020).
 * `onSend` and the typing scope are supplied by the parent, so it serves both
 * channels (scopeType 'channel') and DMs (scopeType 'dm').
 */
export function Composer({
  onSend,
  scopeType,
  scopeId,
  placeholder,
}: {
  onSend: (content: string) => Promise<void>;
  scopeType: "channel" | "dm";
  scopeId: string;
  placeholder: string;
}) {
  const ping = useMutation(api.typing.ping);
  const stop = useMutation(api.typing.stop);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastPingRef = useRef(0);

  const scope = { scopeType, scopeId };

  function onChange(value: string) {
    setText(value);
    if (value.length === 0) {
      void stop(scope);
      return;
    }
    const now = Date.now();
    if (now - lastPingRef.current > TYPING_THROTTLE_MS) {
      lastPingRef.current = now;
      void ping(scope);
    }
  }

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setError(null);
    setText("");
    lastPingRef.current = 0;
    void stop(scope);
    try {
      await onSend(content);
    } catch {
      setError("Message failed to send (max 2000 characters).");
      setText(content);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  const remaining = MESSAGE_MAX_CHARS - text.length;

  return (
    <div className="px-4 pb-4">
      {error && <p className="mb-1 text-xs text-danger">{error}</p>}
      <div className="flex items-end gap-2 rounded-lg bg-elevated px-3 py-2">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void stop(scope)}
          rows={1}
          maxLength={MESSAGE_MAX_CHARS}
          placeholder={placeholder}
          aria-label={placeholder}
          className="max-h-40 flex-1 resize-none bg-transparent text-sm text-text-normal outline-none placeholder:text-text-muted"
        />
        {remaining < 200 && (
          <span
            className={`text-xs ${remaining < 0 ? "text-danger" : "text-text-muted"}`}
          >
            {remaining}
          </span>
        )}
      </div>
    </div>
  );
}
