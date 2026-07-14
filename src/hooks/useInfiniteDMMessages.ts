import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MESSAGE_PAGE_SIZE } from "../lib/constants";

/** Newest-first paginated DM history (FR-022), reversed to chronological display. */
export function useInfiniteDMMessages(threadId: Id<"directMessageThreads">) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.directMessages.list,
    { threadId },
    { initialNumItems: MESSAGE_PAGE_SIZE },
  );
  const messages = [...results].reverse();
  return { messages, status, loadMore, isLoading };
}
