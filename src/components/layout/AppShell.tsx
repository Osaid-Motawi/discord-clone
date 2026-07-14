import { Outlet } from "react-router-dom";
import { ServerRailNav } from "../server/ServerRail";
import { ChannelSidebar } from "./ChannelSidebar";
import { MemberList } from "./MemberList";
import { CurrentUserBar } from "../user/CurrentUserBar";
import { useHeartbeat } from "../../hooks/useHeartbeat";

/**
 * Discord-like four-pane shell: server rail → channel sidebar → main pane → member list.
 * Serves as the layout route; the main pane renders the matched child route (<Outlet/>).
 * The presence heartbeat runs while any authenticated view is mounted.
 */
export function AppShell() {
  useHeartbeat();
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ServerRailNav />
      <div className="flex w-60 flex-col">
        <div className="min-h-0 flex-1">
          <ChannelSidebar />
        </div>
        <CurrentUserBar />
      </div>
      <main className="flex flex-1 flex-col bg-chat">
        <Outlet />
      </main>
      <MemberList />
    </div>
  );
}
