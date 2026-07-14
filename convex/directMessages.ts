import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireUser, requireDMParticipant } from "./model/auth";
import { normalizeMessageContent, canonicalPair } from "./model/validators";

// Direct messages (FR-021–FR-023). DMs behave like channels: real-time, edit/delete,
// typing (typing.* with scopeType:'dm'). Every function is guarded.

/** True if the two users share at least one server (FR-021). */
async function shareAServer(
  ctx: QueryCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const aServers = new Set(
    (
      await ctx.db
        .query("serverMembers")
        .withIndex("by_user", (q) => q.eq("userId", a))
        .collect()
    ).map((m) => m.serverId),
  );
  const bMemberships = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", b))
    .collect();
  return bMemberships.some((m) => aServers.has(m.serverId));
}

/** Open (or reuse) a 1-on-1 DM with a user who shares a server (FR-021, FR-023). */
export const openThread = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (args.otherUserId === userId) {
      throw new Error("You cannot open a DM with yourself.");
    }
    if (!(await shareAServer(ctx, userId, args.otherUserId))) {
      throw new Error("You can only DM members of a shared server.");
    }
    const [userA, userB] = canonicalPair(userId, args.otherUserId);
    const existing = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_pair", (q) => q.eq("userA", userA).eq("userB", userB))
      .unique();
    if (existing !== null) {
      return { threadId: existing._id };
    }
    const threadId = await ctx.db.insert("directMessageThreads", {
      userA,
      userB,
    });
    return { threadId };
  },
});

/** Count of the other participant's messages posted after `since` (unread). */
async function countUnread(
  ctx: QueryCtx,
  threadId: Id<"directMessageThreads">,
  callerId: Id<"users">,
  since: number,
): Promise<number> {
  const recent = await ctx.db
    .query("directMessages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId).gt("_creationTime", since))
    .collect();
  return recent.filter((m) => m.authorId !== callerId).length;
}

/** The caller's DM threads with the other participant's profile + unread count (FR-023a). */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const asA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userA", (q) => q.eq("userA", userId))
      .collect();
    const asB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userB", (q) => q.eq("userB", userId))
      .collect();
    const threads = [...asA, ...asB];
    return await Promise.all(
      threads.map(async (thread) => {
        const otherId = thread.userA === userId ? thread.userB : thread.userA;
        const other = await ctx.db.get(otherId);
        const lastRead =
          (thread.userA === userId ? thread.lastReadA : thread.lastReadB) ?? 0;
        const unreadCount = await countUnread(ctx, thread._id, userId, lastRead);
        return {
          threadId: thread._id,
          otherUser: {
            _id: otherId,
            name: other?.name,
            image: other?.image,
          },
          unreadCount,
        };
      }),
    );
  },
});

/** Total unread DM messages across all of the caller's threads (FR-023a). */
export const unreadTotal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const asA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userA", (q) => q.eq("userA", userId))
      .collect();
    const asB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userB", (q) => q.eq("userB", userId))
      .collect();
    const counts = await Promise.all(
      [...asA, ...asB].map((thread) => {
        const lastRead =
          (thread.userA === userId ? thread.lastReadA : thread.lastReadB) ?? 0;
        return countUnread(ctx, thread._id, userId, lastRead);
      }),
    );
    return counts.reduce((sum, n) => sum + n, 0);
  },
});

/** Mark a DM thread as read up to now (FR-023a). Call when the thread is open/viewed. */
export const markRead = mutation({
  args: { threadId: v.id("directMessageThreads") },
  handler: async (ctx, args) => {
    const userId = await requireDMParticipant(ctx, args.threadId);
    const thread = await ctx.db.get(args.threadId);
    if (thread === null) return null;
    const patch =
      thread.userA === userId
        ? { lastReadA: Date.now() }
        : { lastReadB: Date.now() };
    await ctx.db.patch(args.threadId, patch);
    return null;
  },
});

/** A single DM thread the caller participates in. */
export const getThread = query({
  args: { threadId: v.id("directMessageThreads") },
  handler: async (ctx, args) => {
    const userId = await requireDMParticipant(ctx, args.threadId);
    const thread = await ctx.db.get(args.threadId);
    if (thread === null) return null;
    const otherId = thread.userA === userId ? thread.userB : thread.userA;
    const other = await ctx.db.get(otherId);
    return {
      threadId: thread._id,
      otherUser: { _id: otherId, name: other?.name, image: other?.image },
    };
  },
});

/** Newest-first, paginated DM history with author profile (FR-022). */
export const list = query({
  args: {
    threadId: v.id("directMessageThreads"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireDMParticipant(ctx, args.threadId);
    const result = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        return {
          ...message,
          authorName: author?.name,
          authorImage: author?.image,
        };
      }),
    );
    return { ...result, page };
  },
});

/** Send a DM (FR-022, FR-016a). */
export const send = mutation({
  args: { threadId: v.id("directMessageThreads"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireDMParticipant(ctx, args.threadId);
    const content = normalizeMessageContent(args.content);
    const messageId = await ctx.db.insert("directMessages", {
      threadId: args.threadId,
      authorId: userId,
      content,
    });
    return { messageId };
  },
});

/** Load a DM message the caller authored (participant + author guard). */
async function requireOwnDM(ctx: QueryCtx, messageId: Id<"directMessages">) {
  const userId = await requireUser(ctx);
  const message = await ctx.db.get(messageId);
  if (message === null) throw new Error("Message not found.");
  await requireDMParticipant(ctx, message.threadId);
  if (message.authorId !== userId) {
    throw new Error("Only the author can edit or delete this message.");
  }
  return message;
}

/** Edit an own DM message; marks it edited (FR-022). */
export const edit = mutation({
  args: { messageId: v.id("directMessages"), content: v.string() },
  handler: async (ctx, args) => {
    await requireOwnDM(ctx, args.messageId);
    const content = normalizeMessageContent(args.content);
    await ctx.db.patch(args.messageId, { content, editedAt: Date.now() });
    return null;
  },
});

/** Delete an own DM message (FR-022). */
export const remove = mutation({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, args) => {
    await requireOwnDM(ctx, args.messageId);
    await ctx.db.delete(args.messageId);
    return null;
  },
});
