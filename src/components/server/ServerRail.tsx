import { useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CreateServerModal } from "./CreateServerModal";
import { UnreadBadge } from "../common/UnreadBadge";

/** Far-left server rail: home, the caller's servers, and a create button (FR-005). */
export function ServerRailNav() {
  const servers = useQuery(api.servers.listMine, {}) ?? [];
  const unreadDMs = useQuery(api.directMessages.unreadTotal, {}) ?? 0;
  const { serverId } = useParams();
  const [creating, setCreating] = useState(false);

  return (
    <nav
      className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-rail py-3"
      aria-label="Servers"
    >
      <RailSlot active={!serverId}>
        <div className="relative">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white transition-all duration-200 ${
                isActive && !serverId
                  ? "rounded-xl bg-accent-gradient shadow-glow"
                  : "bg-sidebar hover:rounded-xl hover:bg-accent"
              }`
            }
            title="Home"
          >
            D
          </NavLink>
          {unreadDMs > 0 && (
            <span className="absolute -right-1 -top-1">
              <UnreadBadge count={unreadDMs} />
            </span>
          )}
        </div>
      </RailSlot>
      <div className="h-px w-8 bg-white/5" />

      {servers.map((server) => {
        const active = server._id === serverId;
        return (
          <RailSlot key={server._id} active={active}>
            <NavLink
              to={`/servers/${server._id}`}
              title={server.name}
              className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-white transition-all duration-200 hover:rounded-xl ${
                active
                  ? "rounded-xl bg-accent-gradient shadow-glow"
                  : "bg-sidebar hover:bg-accent"
              }`}
            >
              {server.imageUrl ? (
                <img
                  src={server.imageUrl}
                  alt={server.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                server.name.slice(0, 2).toUpperCase()
              )}
            </NavLink>
          </RailSlot>
        );
      })}

      <button
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar text-2xl font-light text-online transition-all duration-200 hover:rounded-xl hover:bg-online hover:text-white hover:shadow-[0_0_0_1px_rgba(45,212,167,0.4),0_6px_20px_-6px_rgba(45,212,167,0.5)]"
        onClick={() => setCreating(true)}
        title="Create a server"
        aria-label="Create a server"
      >
        +
      </button>

      <CreateServerModal open={creating} onClose={() => setCreating(false)} />
    </nav>
  );
}

/** Wraps a rail icon with the small left accent pill Discord-style UIs use to mark the active item. */
function RailSlot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full items-center justify-center">
      <span
        className={`absolute left-0 rounded-r-full bg-white transition-all duration-200 ${
          active ? "h-8 w-1 opacity-100" : "h-2 w-1 opacity-0"
        }`}
      />
      {children}
    </div>
  );
}
