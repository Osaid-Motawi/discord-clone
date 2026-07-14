import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

/** Create a text or voice channel (owner, FR-013). */
export function CreateChannelModal({
  open,
  onClose,
  serverId,
}: {
  open: boolean;
  onClose: () => void;
  serverId: Id<"servers">;
}) {
  const create = useMutation(api.channels.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { channelId } = await create({ serverId, name, type });
      setName("");
      setType("text");
      onClose();
      if (type === "text") {
        navigate(`/servers/${serverId}/channels/${channelId}`);
      }
    } catch {
      setError("Could not create channel. Name must be 1–64 characters.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Create channel" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(["text", "voice"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded px-3 py-2 text-sm ${
                type === t
                  ? "bg-accent text-white"
                  : "bg-rail text-text-muted hover:text-text-normal"
              }`}
            >
              {t === "text" ? "# Text" : "🔊 Voice"}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Channel name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            required
            autoFocus
            className="rounded bg-rail px-3 py-2 text-text-normal outline-none ring-accent focus:ring-2"
          />
        </label>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
