import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, requireCallAccess } from "./model/auth";

// WebRTC signaling exchanged through Convex — replaces a Socket.io server
// (research.md §8). `payload` is an opaque serialized SDP/ICE string (the one
// justified external boundary, Principle III note).

/** Send a directed SDP offer/answer or ICE candidate to another call participant. */
export const send = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    kind: v.union(v.literal("offer"), v.literal("answer"), v.literal("candidate")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const fromUserId = await requireCallAccess(ctx, args.callId);
    await ctx.db.insert("signals", {
      callId: args.callId,
      fromUserId,
      toUserId: args.toUserId,
      kind: args.kind,
      payload: args.payload,
    });
    return null;
  },
});

/** Signals addressed to the caller for a call, oldest first (ordering matters). */
export const inbox = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await requireCallAccess(ctx, args.callId);
    return await ctx.db
      .query("signals")
      .withIndex("by_recipient", (q) =>
        q.eq("callId", args.callId).eq("toUserId", userId),
      )
      .order("asc")
      .collect();
  },
});

/** Delete a consumed signal (recipient-owned cleanup). */
export const ack = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const signal = await ctx.db.get(args.signalId);
    if (signal === null) return null; // already consumed/cleaned up — fine
    if (signal.toUserId !== userId) {
      throw new Error("Cannot acknowledge another user's signal.");
    }
    await ctx.db.delete(args.signalId);
    return null;
  },
});
