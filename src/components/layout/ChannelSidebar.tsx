import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { InviteModal } from "../server/InviteModal";
import { RenameServerModal } from "../server/RenameServerModal";
import { CreateChannelModal } from "../server/CreateChannelModal";
import { RenameChannelModal } from "../server/RenameChannelModal";

/**
 * Channel sidebar: server name + owner actions, and the channel list (FR-012).
 * The owner can create/rename/delete text & voice channels (FR-013/014).
 */
export function ChannelSidebar() {
  const { serverId, channelId } = useParams();
  const typedServerId = serverId as Id<"servers"> | undefined;
  const server = useQuery(
    api.servers.get,
    typedServerId ? { serverId: typedServerId } : "skip",
  );
  const channels = useQuery(
    api.channels.list,
    typedServerId ? { serverId: typedServerId } : "skip",
  );
  const me = useQuery(api.users.me, {});
  const removeServer = useMutation(api.servers.remove);
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [renamingServer, setRenamingServer] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Doc<"channels"> | null>(null);

  const isOwner = !!server && !!me && server.ownerId === me._id;

  async function onDeleteServer() {
    if (!server) return;
    if (!window.confirm(`Delete "${server.name}"? This cannot be undone.`)) return;
    await removeServer({ serverId: server._id });
    navigate("/", { replace: true });
  }

  return (
    <div className="flex h-full w-full flex-col bg-sidebar">
      <div className="relative flex h-12 items-center justify-between border-b border-rail px-4 font-semibold text-text-normal">
        <span className="truncate">
          {!typedServerId ? "Select a server" : (server?.name ?? "Loading…")}
        </span>
        {typedServerId && server && (
          <button
            className="text-text-muted hover:text-text-normal"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Server menu"
          >
            ▾
          </button>
        )}
        {menuOpen && server && (
          <div
            className="absolute right-2 top-11 z-10 w-44 rounded bg-rail py-1 shadow-lg"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <MenuItem
              label="Invite people"
              onClick={() => {
                setInviting(true);
                setMenuOpen(false);
              }}
            />
            {isOwner && (
              <>
                <MenuItem
                  label="Create channel"
                  onClick={() => {
                    setCreatingChannel(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Rename server"
                  onClick={() => {
                    setRenamingServer(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem label="Delete server" danger onClick={onDeleteServer} />
              </>
            )}
          </div>
        )}
      </div>

      {typedServerId && (
        <div className="flex items-center justify-between px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span>Channels</span>
          {isOwner && (
            <button
              className="text-base leading-none hover:text-text-normal"
              onClick={() => setCreatingChannel(true)}
              aria-label="Create channel"
              title="Create channel"
            >
              +
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {!typedServerId && (
          <p className="px-2 py-1 text-sm text-text-muted">
            Pick a server on the left.
          </p>
        )}
        {(channels ?? []).map((channel) => (
          <ChannelRow
            key={channel._id}
            channel={channel}
            active={channel._id === channelId}
            isOwner={isOwner}
            serverId={typedServerId!}
            currentChannelId={channelId}
            onRename={() => setRenameTarget(channel)}
          />
        ))}
      </div>

      {server && isOwner && (
        <>
          <InviteModal
            open={inviting}
            onClose={() => setInviting(false)}
            serverId={server._id}
            inviteCode={server.inviteCode}
          />
          <RenameServerModal
            open={renamingServer}
            onClose={() => setRenamingServer(false)}
            serverId={server._id}
            currentName={server.name}
          />
          <CreateChannelModal
            open={creatingChannel}
            onClose={() => setCreatingChannel(false)}
            serverId={server._id}
          />
          {renameTarget && (
            <RenameChannelModal
              open={true}
              onClose={() => setRenameTarget(null)}
              channelId={renameTarget._id}
              currentName={renameTarget.name}
            />
          )}
        </>
      )}
    </div>
  );
}

function ChannelRow({
  channel,
  active,
  isOwner,
  serverId,
  currentChannelId,
  onRename,
}: {
  channel: Doc<"channels">;
  active: boolean;
  isOwner: boolean;
  serverId: Id<"servers">;
  currentChannelId: string | undefined;
  onRename: () => void;
}) {
  const removeChannel = useMutation(api.channels.remove);
  const navigate = useNavigate();
  const isText = channel.type === "text";

  async function onDelete() {
    if (
      !window.confirm(
        `Delete #${channel.name}? Its messages will be permanently removed.`,
      )
    ) {
      return;
    }
    await removeChannel({ channelId: channel._id });
    if (currentChannelId === channel._id) {
      navigate(`/servers/${serverId}`, { replace: true });
    }
  }

  const label = (
    <span className="truncate">
      <span className="text-text-muted">{isText ? "#" : "🔊"}</span>{" "}
      {channel.name}
    </span>
  );

  return (
    <div className="group flex items-center rounded px-2 py-1 hover:bg-elevated/60">
      {isText ? (
        <NavLink
          to={`/servers/${serverId}/channels/${channel._id}`}
          className={`min-w-0 flex-1 text-sm ${
            active ? "text-text-normal" : "text-text-muted"
          }`}
        >
          {label}
        </NavLink>
      ) : (
        <span
          className="min-w-0 flex-1 text-sm text-text-muted"
          title="Voice channels arrive in User Story 6"
        >
          {label}
        </span>
      )}
      {isOwner && (
        <span className="hidden shrink-0 gap-1 pl-1 text-xs text-text-muted group-hover:flex">
          <button className="hover:text-text-normal" onClick={onRename} title="Rename">
            ✎
          </button>
          <button className="hover:text-danger" onClick={onDelete} title="Delete">
            🗑
          </button>
        </span>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-elevated ${
        danger ? "text-danger" : "text-text-normal"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
