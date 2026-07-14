import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useNow } from "../../hooks/useNow";
import { TYPING_STALE_MS } from "../../lib/constants";

/** "X is typing…" for a channel or DM scope (FR-020). Stale rows filtered client-side. */
export function TypingIndicator({
  scopeType,
  scopeId,
}: {
  scopeType: "channel" | "dm";
  scopeId: string;
}) {
  const typers = useQuery(api.typing.list, { scopeType, scopeId }) ?? [];
  const now = useNow(2000);

  const names = typers
    .filter((t) => now - t.updatedAt < TYPING_STALE_MS)
    .map((t) => t.name ?? "Someone");

  let text = " "; // non-breaking space keeps the row height stable
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else if (names.length > 2) text = "Several people are typing…";

  return <div className="h-5 px-4 text-xs text-text-muted">{text}</div>;
}
