import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Shared cascade deletes, reused by servers.remove and channels.remove (Principle I).

/** Delete a call and its participants + signaling rows. */
export async function deleteCallCascade(ctx: MutationCtx, callId: Id<"calls">) {
  const participants = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  for (const p of participants) await ctx.db.delete(p._id);

  const signals = await ctx.db
    .query("signals")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  for (const s of signals) await ctx.db.delete(s._id);

  await ctx.db.delete(callId);
}

/** Delete a channel's messages and any active call, then the channel itself (FR-014). */
export async function deleteChannelCascade(
  ctx: MutationCtx,
  channelId: Id<"channels">,
) {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  for (const message of messages) await ctx.db.delete(message._id);

  const calls = await ctx.db
    .query("calls")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  for (const call of calls) await deleteCallCascade(ctx, call._id);

  await ctx.db.delete(channelId);
}
