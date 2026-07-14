import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { ProfileEditor } from "./ProfileEditor";
import { useNow } from "../../hooks/useNow";
import { isOnline } from "../../lib/presence";

/**
 * Bottom-left panel showing the signed-in user with a live online indicator,
 * plus profile edit and sign-out (FR-001, FR-002, FR-003).
 */
export function CurrentUserBar() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.me, {});
  const presence = useQuery(
    api.presence.listForUsers,
    me ? { userIds: [me._id] } : "skip",
  );
  const now = useNow();
  const [editing, setEditing] = useState(false);

  if (me === undefined) return null;
  if (me === null) return null;

  const lastSeen = presence?.[0]?.lastSeen ?? 0;
  const online = isOnline(lastSeen, now);

  return (
    <div className="flex items-center gap-2 bg-rail px-2 py-2">
      <Avatar name={me.name} image={me.image} size={32} online={online} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-normal">
          {me.name ?? "Unnamed"}
        </div>
        <div className="text-xs text-text-muted">
          {online ? "Online" : "Offline"}
        </div>
      </div>
      <button
        className="rounded px-2 py-1 text-xs text-text-muted hover:bg-elevated hover:text-text-normal"
        onClick={() => setEditing(true)}
      >
        Edit
      </button>
      <Button variant="secondary" onClick={() => void signOut()} className="px-2 py-1 text-xs">
        Sign out
      </Button>

      <ProfileEditor
        open={editing}
        onClose={() => setEditing(false)}
        initialName={me.name ?? ""}
        initialImage={me.image ?? ""}
      />
    </div>
  );
}
