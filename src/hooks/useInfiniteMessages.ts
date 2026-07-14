import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MESSAGE_PAGE_SIZE } from "../lib/constants";

/**
 * Newest-first paginated channel history (FR-019). Server returns messages
 * descending; we reverse to chronological (oldest→newest) for display, and new
 * live messages append at the bottom via the subscription.
 */
export function useInfiniteMessages(channelId: Id<"channels">) {
  const { results, status, loadMore, isLoading } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: MESSAGE_PAGE_SIZE },
  );
  const messages = [...results].reverse();
  return { messages, status, loadMore, isLoading };
}
