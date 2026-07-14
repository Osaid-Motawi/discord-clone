import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Spinner } from "../components/common/Spinner";
import { EmptyState } from "../components/common/EmptyState";

/** Accepts an invite link: joins the server (FR-007), then redirects into it. */
export function InviteAcceptPage() {
  const { code } = useParams();
  const join = useMutation(api.servers.joinByInvite);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!code) return;
      try {
        const { serverId } = await join({ inviteCode: code });
        if (active) navigate(`/servers/${serverId}`, { replace: true });
      } catch {
        if (active) setError("This invite link is invalid or has expired.");
      }
    })();
    return () => {
      active = false;
    };
  }, [code, join, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-chat">
      {error ? (
        <EmptyState title="Can’t join">
          {error}
          <div className="mt-2">
            <Link to="/" className="text-accent hover:underline">
              Go home
            </Link>
          </div>
        </EmptyState>
      ) : (
        <Spinner label="Joining server…" />
      )}
    </div>
  );
}
