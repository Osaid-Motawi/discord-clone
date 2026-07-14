import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireMember, requireMessageAuthor } from "./model/auth";
import { normalizeMessageContent } from "./model/validators";

// Channel messaging (FR-016–FR-019, FR-016a). Every function is guarded.

/** Newest-first, paginated channel history with author profile (FR-017, FR-019). */
export const list = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) throw new Error("Channel not found.");
    await requireMember(ctx, channel.serverId);

    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
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

/** Send a message to a text channel (FR-016, FR-016a). */
export const send = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) throw new Error("Channel not found.");
    if (channel.type !== "text") {
      throw new Error("Messages can only be sent to text channels.");
    }
    const userId = await requireMember(ctx, channel.serverId);
    const content = normalizeMessageContent(args.content);
    const messageId = await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: userId,
      content,
    });
    return { messageId };
  },
});

/** Edit an own message; marks it edited (FR-018). Author-only. */
export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    await requireMessageAuthor(ctx, args.messageId);
    const content = normalizeMessageContent(args.content);
    await ctx.db.patch(args.messageId, { content, editedAt: Date.now() });
    return null;
  },
});

/** Delete an own message (FR-018). Author-only. */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireMessageAuthor(ctx, args.messageId);
    await ctx.db.delete(args.messageId);
    return null;
  },
});
