import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  PRESENCE_STALE_MS,
  TYPING_STALE_MS,
  CALL_STALE_MS,
} from "./model/validators";

/**
 * Single consolidated staleness sweep (Constitution Principle I — one cron-driven
 * sweep rather than one per table). Covers everything that would otherwise grow
 * unboundedly or go stale without an explicit user action:
 *  - presence rows past the online/offline threshold (FR-003),
 *  - typing indicators nobody explicitly stopped (FR-020),
 *  - call participants whose heartbeat lapsed — unexpected disconnect (FR-031),
 *    deactivating any call that becomes empty as a result, and
 *  - orphan signaling rows for calls that just became inactive.
 * Runs in one transaction; wired to a single `crons.interval` in `convex/crons.ts`.
 */
export const sweepAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const stalePresence = await ctx.db
      .query("presence")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", now - PRESENCE_STALE_MS))
      .collect();
    for (const row of stalePresence) await ctx.db.delete(row._id);

    // No index on `updatedAt` alone — the table is small and ephemeral, so an
    // in-memory filter is simpler than adding an index just for this sweep.
    const allTyping = await ctx.db.query("typingIndicators").collect();
    for (const row of allTyping) {
      if (now - row.updatedAt > TYPING_STALE_MS) await ctx.db.delete(row._id);
    }

    const staleParticipants = await ctx.db
      .query("callParticipants")
      .withIndex("by_lastSeen", (q) => q.lt("lastSeen", now - CALL_STALE_MS))
      .collect();
    const touchedCallIds = new Set<Id<"calls">>();
    for (const row of staleParticipants) {
      await ctx.db.delete(row._id);
      touchedCallIds.add(row.callId);
    }
    for (const callId of touchedCallIds) {
      const remaining = await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect();
      if (remaining.length === 0) {
        const call = await ctx.db.get(callId);
        if (call !== null && call.active) {
          await ctx.db.patch(callId, { active: false });
        }
        const signals = await ctx.db
          .query("signals")
          .withIndex("by_call", (q) => q.eq("callId", callId))
          .collect();
        for (const s of signals) await ctx.db.delete(s._id);
      }
    }

    return null;
  },
});
