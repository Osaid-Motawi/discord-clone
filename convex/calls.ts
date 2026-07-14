import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  requireMember,
  requireDMParticipant,
  requireCallAccess,
} from "./model/auth";
import { MAX_CALL_PARTICIPANTS } from "./model/validators";

// Note: staleness sweeping (unexpected disconnects, FR-031) is consolidated into
// `convex/maintenance.ts`'s single cron-driven sweep, alongside presence and
// typing cleanup (Constitution Principle I — one sweep, not one per table).

// Voice/video calls (FR-024–FR-032). A call is scoped to a voice channel or a DM
// thread; `active` tracks whether anyone is currently connected.

/** Find the currently-active call for a scope, if any. */
async function findActiveCall(
  ctx: QueryCtx,
  scopeType: "channel" | "dm",
  scopeId: Id<"channels"> | Id<"directMessageThreads">,
) {
  if (scopeType === "channel") {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_channel", (q) => q.eq("channelId", scopeId as Id<"channels">))
      .collect();
    return calls.find((c) => c.active) ?? null;
  }
  const calls = await ctx.db
    .query("calls")
    .withIndex("by_thread", (q) =>
      q.eq("threadId", scopeId as Id<"directMessageThreads">),
    )
    .collect();
  return calls.find((c) => c.active) ?? null;
}

/** Remove a user's existing call-participant row, deactivating an emptied call. */
async function leaveAnyExistingCall(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("callParticipants")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", row.callId))
      .collect();
    if (remaining.length === 0) {
      await ctx.db.patch(row.callId, { active: false });
    }
  }
}

/**
 * Join a voice channel's call, or a DM call, starting one if needed (FR-024).
 * Enforces a single active call per user (FR-032) and the participant cap (FR-025).
 */
export const join = mutation({
  args: {
    scopeType: v.union(v.literal("channel"), v.literal("dm")),
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
  },
  handler: async (ctx, args) => {
    let userId: Id<"users">;
    if (args.scopeType === "channel") {
      if (args.channelId === undefined) throw new Error("channelId is required.");
      const channel = await ctx.db.get(args.channelId);
      if (channel === null) throw new Error("Channel not found.");
      if (channel.type !== "voice") {
        throw new Error("Calls can only be joined in voice channels.");
      }
      userId = await requireMember(ctx, channel.serverId);
    } else {
      if (args.threadId === undefined) throw new Error("threadId is required.");
      userId = await requireDMParticipant(ctx, args.threadId);
    }

    // Single active call: leave whatever call this user was previously in (FR-032).
    await leaveAnyExistingCall(ctx, userId);

    const scopeId = args.scopeType === "channel" ? args.channelId! : args.threadId!;
    let call = await findActiveCall(ctx, args.scopeType, scopeId);
    if (call === null) {
      const callId = await ctx.db.insert("calls", {
        scopeType: args.scopeType,
        channelId: args.scopeType === "channel" ? args.channelId : undefined,
        threadId: args.scopeType === "dm" ? args.threadId : undefined,
        active: true,
      });
      call = await ctx.db.get(callId);
    }
    if (call === null) throw new Error("Failed to start call.");

    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", call!._id))
      .collect();
    if (participants.length >= MAX_CALL_PARTICIPANTS) {
      throw new Error("This call is full.");
    }

    await ctx.db.insert("callParticipants", {
      callId: call._id,
      userId,
      micEnabled: true,
      cameraEnabled: false,
      lastSeen: Date.now(),
    });

    return { callId: call._id };
  },
});

/** Leave a call (FR-028). Deactivates the call if it's now empty. */
export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await requireCallAccess(ctx, args.callId);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", args.callId).eq("userId", userId),
      )
      .unique();
    if (row !== null) {
      await ctx.db.delete(row._id);
    }
    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", args.callId))
      .collect();
    if (remaining.length === 0) {
      await ctx.db.patch(args.callId, { active: false });
    }
    return null;
  },
});

/** Refresh the caller's participant heartbeat (stale rows are swept, FR-031). */
export const heartbeat = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    const userId = await requireCallAccess(ctx, args.callId);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", args.callId).eq("userId", userId),
      )
      .unique();
    if (row !== null) {
      await ctx.db.patch(row._id, { lastSeen: Date.now() });
    }
    return null;
  },
});

/** Update the caller's mic/camera state (FR-026, FR-027). */
export const setMedia = mutation({
  args: {
    callId: v.id("calls"),
    micEnabled: v.optional(v.boolean()),
    cameraEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireCallAccess(ctx, args.callId);
    const row = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_user", (q) =>
        q.eq("callId", args.callId).eq("userId", userId),
      )
      .unique();
    if (row === null) throw new Error("Not a participant of this call.");
    const patch: { micEnabled?: boolean; cameraEnabled?: boolean } = {};
    if (args.micEnabled !== undefined) patch.micEnabled = args.micEnabled;
    if (args.cameraEnabled !== undefined) patch.cameraEnabled = args.cameraEnabled;
    await ctx.db.patch(row._id, patch);
    return null;
  },
});

/** Live participants of a call, for video tiles and muted indicators (FR-027). */
export const roster = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, args) => {
    await requireCallAccess(ctx, args.callId);
    const rows = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", args.callId))
      .collect();
    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return {
          userId: row.userId,
          name: user?.name,
          image: user?.image,
          micEnabled: row.micEnabled,
          cameraEnabled: row.cameraEnabled,
        };
      }),
    );
  },
});

/**
 * The active call for a DM thread, if any (FR-030, US7 #1). Reactive: when one
 * participant starts a call, the other's subscription flips from `null` to a
 * live call so they can join — no separate notification mechanism needed.
 */
export const activeForThread = query({
  args: { threadId: v.id("directMessageThreads") },
  handler: async (ctx, args) => {
    await requireDMParticipant(ctx, args.threadId);
    const call = await findActiveCall(ctx, "dm", args.threadId);
    if (call === null) return null;
    const participantCount = (
      await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .collect()
    ).length;
    return { callId: call._id, participantCount };
  },
});

/** Who is connected to each voice channel of a server (FR-029). */
export const connectedByChannel = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.serverId);
    const voiceChannels = (
      await ctx.db
        .query("channels")
        .withIndex("by_server_type", (q) =>
          q.eq("serverId", args.serverId).eq("type", "voice"),
        )
        .collect()
    ).filter((c) => c.type === "voice");

    return await Promise.all(
      voiceChannels.map(async (channel) => {
        const call = await findActiveCall(ctx, "channel", channel._id);
        if (call === null) {
          return { channelId: channel._id, participants: [] };
        }
        const rows = await ctx.db
          .query("callParticipants")
          .withIndex("by_call", (q) => q.eq("callId", call._id))
          .collect();
        const participants = await Promise.all(
          rows.map(async (row) => {
            const user = await ctx.db.get(row.userId);
            return { userId: row.userId, name: user?.name };
          }),
        );
        return { channelId: channel._id, participants };
      }),
    );
  },
});
