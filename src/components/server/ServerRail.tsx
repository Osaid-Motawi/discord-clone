import { useState } from "react";
import { useQuery } from "convex/react";
import { NavLink, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CreateServerModal } from "./CreateServerModal";

/** Far-left server rail: home, the caller's servers, and a create button (FR-005). */
export function ServerRailNav() {
  const servers = useQuery(api.servers.listMine, {}) ?? [];
  const { serverId } = useParams();
  const [creating, setCreating] = useState(false);

  return (
    <nav
      className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-rail py-3"
      aria-label="Servers"
    >
      <NavLink
        to="/"
        className={({ isActive }) =>
          `flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white transition-all ${
            isActive && !serverId ? "bg-accent" : "bg-sidebar hover:bg-accent"
          }`
        }
        title="Home"
      >
        D
      </NavLink>
      <div className="h-px w-8 bg-elevated" />

      {servers.map((server) => {
        const active = server._id === serverId;
        return (
          <NavLink
            key={server._id}
            to={`/servers/${server._id}`}
            title={server.name}
            className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold text-white transition-all hover:rounded-xl ${
              active ? "rounded-xl bg-accent" : "bg-sidebar hover:bg-accent"
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
        );
      })}

      <button
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar text-2xl font-light text-online transition-all hover:rounded-xl hover:bg-online hover:text-white"
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
