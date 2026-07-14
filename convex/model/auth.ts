import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

// Centralized authorization guards (Constitution Principle IV). Every query/mutation
// calls the appropriate guard FIRST; a guard that cannot establish authorization throws.
// `QueryCtx` is a supertype of `MutationCtx`, so these accept both.

/** Require an authenticated user; returns their id or throws (FR-004). */
export async function requireUser(ctx: QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

/** Require that the caller is a member of the given server; returns the caller id. */
export async function requireMember(
  ctx: QueryCtx,
  serverId: Id<"servers">,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (membership === null) {
    throw new Error("Not a member of this server.");
  }
  return userId;
}

/** Require that the caller is the owner of the given server; returns the caller id. */
export async function requireOwner(
  ctx: QueryCtx,
  serverId: Id<"servers">,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const server = await ctx.db.get(serverId);
  if (server === null) {
    throw new Error("Server not found.");
  }
  if (server.ownerId !== userId) {
    throw new Error("Only the server owner can perform this action.");
  }
  return userId;
}

/** Require that the caller authored the given channel message; returns the caller id. */
export async function requireMessageAuthor(
  ctx: QueryCtx,
  messageId: Id<"messages">,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const message = await ctx.db.get(messageId);
  if (message === null) {
    throw new Error("Message not found.");
  }
  if (message.authorId !== userId) {
    throw new Error("Only the author can edit or delete this message.");
  }
  return userId;
}

/** Require that the caller is one of the two participants of a DM thread. */
export async function requireDMParticipant(
  ctx: QueryCtx,
  threadId: Id<"directMessageThreads">,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const thread = await ctx.db.get(threadId);
  if (thread === null) {
    throw new Error("DM conversation not found.");
  }
  if (thread.userA !== userId && thread.userB !== userId) {
    throw new Error("Not a participant of this conversation.");
  }
  return userId;
}

/** Require that the caller has access to the call's scope (voice channel or DM). */
export async function requireCallAccess(
  ctx: QueryCtx,
  callId: Id<"calls">,
): Promise<Id<"users">> {
  const userId = await requireUser(ctx);
  const call = await ctx.db.get(callId);
  if (call === null) {
    throw new Error("Call not found.");
  }
  if (call.scopeType === "channel") {
    if (call.channelId === undefined) {
      throw new Error("Malformed call.");
    }
    const channel = await ctx.db.get(call.channelId);
    if (channel === null) {
      throw new Error("Channel not found.");
    }
    // Reuse membership guard for the channel's server.
    await requireMember(ctx, channel.serverId);
    return userId;
  }
  // DM-scoped call
  if (call.threadId === undefined) {
    throw new Error("Malformed call.");
  }
  await requireDMParticipant(ctx, call.threadId);
  return userId;
}
