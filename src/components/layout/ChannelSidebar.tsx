import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InviteModal } from "../server/InviteModal";
import { RenameServerModal } from "../server/RenameServerModal";

/**
 * Channel sidebar: server name + owner actions (invite/rename/delete) and the list
 * of channels (FR-012). Channel create/rename/delete UI arrives in US4.
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
  const [renaming, setRenaming] = useState(false);

  const isOwner = !!server && !!me && server.ownerId === me._id;

  async function onDelete() {
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
                  label="Rename server"
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem label="Delete server" danger onClick={onDelete} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!typedServerId && (
          <p className="px-2 py-1 text-sm text-text-muted">
            Pick a server on the left.
          </p>
        )}
        {(channels ?? []).map((channel) =>
          channel.type === "text" ? (
            <NavLink
              key={channel._id}
              to={`/servers/${typedServerId}/channels/${channel._id}`}
              className={`block truncate rounded px-2 py-1 text-sm ${
                channel._id === channelId
                  ? "bg-elevated text-text-normal"
                  : "text-text-muted hover:bg-elevated/60 hover:text-text-normal"
              }`}
            >
              <span className="text-text-muted">#</span> {channel.name}
            </NavLink>
          ) : (
            <div
              key={channel._id}
              className="truncate px-2 py-1 text-sm text-text-muted"
              title="Voice channels arrive in User Story 6"
            >
              🔊 {channel.name}
            </div>
          ),
        )}
      </div>

      {server && isOwner && (
        <InviteModal
          open={inviting}
          onClose={() => setInviting(false)}
          serverId={server._id}
          inviteCode={server.inviteCode}
        />
      )}
      {server && isOwner && (
        <RenameServerModal
          open={renaming}
          onClose={() => setRenaming(false)}
          serverId={server._id}
          currentName={server.name}
        />
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
