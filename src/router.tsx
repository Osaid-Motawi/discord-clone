import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { AuthPage } from "./pages/AuthPage";
import { HomePage } from "./pages/HomePage";
import { ServerPage } from "./pages/ServerPage";
import { ChannelView } from "./pages/ChannelView";
import { DMPage } from "./pages/DMPage";
import { InviteAcceptPage } from "./pages/InviteAcceptPage";
import { AppShell } from "./components/layout/AppShell";
import { Spinner } from "./components/common/Spinner";

// Auth-gated routing (FR-004). Unauthenticated users only reach the auth screen;
// authenticated users get the app shell (server rail → channels → main → members).
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthLoading>
        <div className="flex h-screen items-center justify-center bg-chat">
          <Spinner label="Loading…" />
        </div>
      </AuthLoading>

      <Unauthenticated>
        <AuthPage />
      </Unauthenticated>

      <Authenticated>
        <Routes>
          <Route path="/invite/:code" element={<InviteAcceptPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/servers/:serverId" element={<ServerPage />} />
            <Route
              path="/servers/:serverId/channels/:channelId"
              element={<ChannelView />}
            />
            <Route path="/dms/:threadId" element={<DMPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Authenticated>
    </BrowserRouter>
  );
}
