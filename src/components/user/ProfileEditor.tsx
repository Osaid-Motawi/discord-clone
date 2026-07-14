import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

interface ProfileEditorProps {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialImage: string;
}

/** Edit the current user's display name and avatar URL (FR-002). */
export function ProfileEditor({
  open,
  onClose,
  initialName,
  initialImage,
}: ProfileEditorProps) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name, image });
      onClose();
    } catch {
      setError("Could not save profile. Check the display name (1–32 chars).");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Edit profile" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Display name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            required
            className="rounded bg-rail px-3 py-2 text-text-normal outline-none ring-accent focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Avatar image URL
          </span>
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
