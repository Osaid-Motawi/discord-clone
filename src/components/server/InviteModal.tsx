import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";

/** Show / copy / regenerate a server's invite link (owner, FR-006). */
export function InviteModal({
  open,
  onClose,
  serverId,
  inviteCode,
}: {
  open: boolean;
  onClose: () => void;
  serverId: Id<"servers">;
  inviteCode: string;
}) {
  const generateInvite = useMutation(api.servers.generateInvite);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const link = `${window.location.origin}/invite/${inviteCode}`;

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await generateInvite({ serverId });
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal open={open} title="Invite people" onClose={onClose}>
      <p className="mb-2 text-sm text-text-muted">
        Share this link to let others join. Regenerating invalidates the old link.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 rounded bg-rail px-3 py-2 text-sm text-text-normal outline-none"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button onClick={copy}>{copied ? "Copied!" : "Copy"}</Button>
      </div>
      <div className="mt-4 flex justify-between">
        <Button
          variant="secondary"
          onClick={regenerate}
          disabled={regenerating}
        >
          {regenerating ? "Generating…" : "Generate new link"}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
