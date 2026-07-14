import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

/** Create a new server (FR-005) and navigate to it. */
export function CreateServerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const create = useMutation(api.servers.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { serverId } = await create({
        name,
        imageUrl: imageUrl || undefined,
      });
      setName("");
      setImageUrl("");
      onClose();
      navigate(`/servers/${serverId}`);
    } catch {
      setError("Could not create server. Name must be 1–64 characters.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Create a server" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Server name
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Server image URL (optional)
          </span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            type="url"
            placeholder="https://…"
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
