import { EmptyState } from "../components/common/EmptyState";

/** Authenticated landing (main pane) — prompt to pick or create a server. */
export function HomePage() {
  return (
    <EmptyState title="Welcome">
      Select a server on the left, or create one with the “+” button. Join a
      friend’s server by opening their invite link.
    </EmptyState>
  );
}
