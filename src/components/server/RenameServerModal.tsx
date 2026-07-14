import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

/** Rename a server (owner, FR-009). */
export function RenameServerModal({
  open,
  onClose,
  serverId,
  currentName,
}: {
  open: boolean;
  onClose: () => void;
  serverId: Id<"servers">;
  currentName: string;
}) {
  const rename = useMutation(api.servers.rename);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await rename({ serverId, name });
      onClose();
    } catch {
      setError("Could not rename. Name must be 1–64 characters.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Rename server" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          required
          autoFocus
          className="rounded bg-rail px-3 py-2 text-text-normal outline-none ring-accent focus:ring-2"
        />
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
