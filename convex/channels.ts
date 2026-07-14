import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireMember } from "./model/auth";

// Channel reads (FR-012). Create/rename/delete mutations are added in US4.

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
