import { useQuery, useMutation } from "convex/react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Avatar } from "../common/Avatar";
import { Spinner } from "../common/Spinner";
import { useNow } from "../../hooks/useNow";
import { isOnline } from "../../lib/presence";

/**
 * Right-hand member list with real-time online status (FR-008). The owner can
 * remove members (FR-009). Presence is derived client-side from a live clock.
 */
export function MemberList() {
  const { serverId } = useParams();
  const typedServerId = serverId as Id<"servers"> | undefined;

  const members = useQuery(
    api.servers.listMembers,
    typedServerId ? { serverId: typedServerId } : "skip",
  );
  const me = useQuery(api.users.me, {});
  const presence = useQuery(
    api.presence.listForUsers,
    members && members.length > 0
      ? { userIds: members.map((m) => m.userId) }
      : "skip",
  );
  const now = useNow();
  const removeMember = useMutation(api.servers.removeMember);
  const openThread = useMutation(api.directMessages.openThread);
  const navigate = useNavigate();

  if (!typedServerId) {
    return <aside className="hidden w-60 bg-sidebar lg:block" aria-label="Members" />;
  }

  const lastSeenById = new Map(
    (presence ?? []).map((p) => [p.userId, p.lastSeen]),
  );
  const myRole = members?.find((m) => m.userId === me?._id)?.role;
  const iAmOwner = myRole === "owner";

  const sorted = [...(members ?? [])].sort((a, b) => {
    const aOnline = isOnline(lastSeenById.get(a.userId) ?? 0, now);
    const bOnline = isOnline(lastSeenById.get(b.userId) ?? 0, now);
    if (aOnline !== bOnline) return aOnline ? -1 : 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  async function onRemove(userId: Id<"users">, name?: string) {
    if (!typedServerId) return;
    if (!window.confirm(`Remove ${name ?? "this member"} from the server?`)) {
      return;
    }
    await removeMember({ serverId: typedServerId, userId });
  }

  async function onMessage(userId: Id<"users">) {
    const { threadId } = await openThread({ otherUserId: userId });
    navigate(`/dms/${threadId}`);
  }

  return (
    <aside
      className="hidden w-60 flex-col bg-sidebar lg:flex"
      aria-label="Members"
    >
      <div className="flex h-12 items-center px-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {members === undefined ? "Members" : `Members — ${members.length}`}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {members === undefined && (
          <div className="px-2 py-2">
            <Spinner label="Loading members…" />
          </div>
        )}
        {sorted.map((member) => {
          const online = isOnline(lastSeenById.get(member.userId) ?? 0, now);
          const isSelf = member.userId === me?._id;
          const canRemove = iAmOwner && member.role !== "owner";
          return (
            <div
              key={member.userId}
              className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-elevated"
            >
              <Avatar
                name={member.name}
                image={member.image}
                size={28}
                online={online}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-text-normal">
                {member.name ?? "Unnamed"}
                {member.role === "owner" && (
                  <span className="ml-1 text-xs text-accent">(owner)</span>
                )}
              </span>
              {!isSelf && (
                <button
                  className="text-xs text-accent opacity-0 hover:underline focus:opacity-100 group-hover:opacity-100"
                  onClick={() => onMessage(member.userId)}
                  aria-label={`Message ${member.name ?? "this member"}`}
                >
                  Message
                </button>
              )}
              {canRemove && (
                <button
                  className="text-xs text-danger opacity-0 hover:underline focus:opacity-100 group-hover:opacity-100"
                  onClick={() => onRemove(member.userId, member.name)}
                  aria-label={`Remove ${member.name ?? "this member"}`}
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
