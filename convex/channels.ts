import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireMember, requireOwner } from "./model/auth";
import { normalizeName, CHANNEL_NAME_MAX_CHARS } from "./model/validators";
import { deleteChannelCascade } from "./model/cascade";

// Channels (FR-011–FR-015). Reads are open to members; mutations are owner-only.

/** All channels in a server — every member sees all channels (FR-012). */
export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.serverId);
    return await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
  },
});

/** A single channel the caller can access (member of its server). */
export const get = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) return null;
    await requireMember(ctx, channel.serverId);
    return channel;
  },
});

/** Create a text or voice channel (owner only, FR-013). */
export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.serverId);
    const name = normalizeName(args.name, CHANNEL_NAME_MAX_CHARS, "Channel name");
    const channelId = await ctx.db.insert("channels", {
      serverId: args.serverId,
      name,
      type: args.type,
    });
    return { channelId };
  },
});

/** Rename a channel (owner only, FR-013). */
export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) throw new Error("Channel not found.");
    await requireOwner(ctx, channel.serverId);
    const name = normalizeName(args.name, CHANNEL_NAME_MAX_CHARS, "Channel name");
    await ctx.db.patch(args.channelId, { name });
    return null;
  },
});

/** Delete a channel and all its messages/calls (owner only, FR-014). */
export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) throw new Error("Channel not found.");
    await requireOwner(ctx, channel.serverId);
    await deleteChannelCascade(ctx, args.channelId);
    return null;
  },
});
