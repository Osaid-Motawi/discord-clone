import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireMember, requireDMParticipant } from "./model/auth";

// Typing indicators (FR-020). Reads return raw rows; the client filters by
// TYPING_STALE_MS with a local clock so indicators clear without a server write,
// while pings/stops push updates reactively (Constitution Principle II).

const scopeValidator = v.union(v.literal("channel"), v.literal("dm"));

/** Authorize the caller for a typing scope and return their user id. */
async function authorizeScope(
  ctx: QueryCtx,
  scopeType: "channel" | "dm",
  scopeId: string,
): Promise<Id<"users">> {
  if (scopeType === "channel") {
    const channel = await ctx.db.get(scopeId as Id<"channels">);
    if (channel === null) throw new Error("Channel not found.");
    return await requireMember(ctx, channel.serverId);
  }
  return await requireDMParticipant(ctx, scopeId as Id<"directMessageThreads">);
}

/** Refresh the caller's typing indicator for a scope (throttled by the client). */
export const ping = mutation({
  args: { scopeType: scopeValidator, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await authorizeScope(ctx, args.scopeType, args.scopeId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_scope_user", (q) =>
        q
          .eq("scopeType", args.scopeType)
          .eq("scopeId", args.scopeId)
          .eq("userId", userId),
      )
      .unique();
    const now = Date.now();
    if (existing === null) {
      await ctx.db.insert("typingIndicators", {
        scopeType: args.scopeType,
        scopeId: args.scopeId,
        userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, { updatedAt: now });
    }
    return null;
  },
});

/** Explicitly clear the caller's typing indicator for a scope. */
export const stop = mutation({
  args: { scopeType: scopeValidator, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await authorizeScope(ctx, args.scopeType, args.scopeId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_scope_user", (q) =>
        q
          .eq("scopeType", args.scopeType)
          .eq("scopeId", args.scopeId)
          .eq("userId", userId),
      )
      .unique();
    if (existing !== null) await ctx.db.delete(existing._id);
    return null;
  },
});

/** Users currently typing in a scope (excluding the caller); client filters stale. */
export const list = query({
  args: { scopeType: scopeValidator, scopeId: v.string() },
  handler: async (ctx, args) => {
    const userId = await authorizeScope(ctx, args.scopeType, args.scopeId);
    const rows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_scope", (q) =>
        q.eq("scopeType", args.scopeType).eq("scopeId", args.scopeId),
      )
      .collect();
    const others = rows.filter((r) => r.userId !== userId);
    return await Promise.all(
      others.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { userId: r.userId, name: user?.name, updatedAt: r.updatedAt };
      }),
    );
  },
});
