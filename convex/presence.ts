import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./model/auth";
import { PRESENCE_STALE_MS } from "./model/validators";

// Presence via heartbeat (research.md §4). Reads return raw `lastSeen`; the client
// derives online/offline with a local clock (src/lib/presence.ts) so a user going
// stale is reflected without a server write, while heartbeats push online updates
// reactively (Constitution Principle II — no read polling).

/** Refresh the caller's presence. Called on an interval while connected. */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing === null) {
      await ctx.db.insert("presence", { userId, lastSeen: now });
    } else {
      await ctx.db.patch(existing._id, { lastSeen: now });
    }
    return null;
  },
});

/** Reactive last-seen timestamps for a set of users (client computes isOnline). */
export const listForUsers = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const results: { userId: (typeof args.userIds)[number]; lastSeen: number }[] =
      [];
    for (const userId of args.userIds) {
      const row = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      results.push({ userId, lastSeen: row?.lastSeen ?? 0 });
    }
    return results;
  },
});

/** Delete stale presence rows to bound table size (invoked by cron). */
export const sweepStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_STALE_MS;
    const stale = await ctx.db
      .query("presence")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", cutoff))
      .collect();
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
