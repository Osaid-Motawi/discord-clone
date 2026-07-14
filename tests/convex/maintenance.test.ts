import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  PRESENCE_STALE_MS,
  TYPING_STALE_MS,
} from "../../convex/model/validators";

const modules = import.meta.glob("../../convex/**/*.*s");
type T = ReturnType<typeof convexTest>;

async function makeUser(t: T, name: string) {
  const userId = (await t.run((ctx) =>
    ctx.db.insert("users", { name }),
  )) as Id<"users">;
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

// T056 — the consolidated sweep (Constitution Principle I) covers presence,
// typing, and call-participant staleness in a single mutation.
describe("maintenance.sweepAll", () => {
  it("removes stale presence rows but keeps fresh ones", async () => {
    const t = convexTest(schema, modules);
    const fresh = await makeUser(t, "Fresh");
    const stale = await makeUser(t, "Stale");
    await fresh.as.mutation(api.presence.heartbeat, {});
    await stale.as.mutation(api.presence.heartbeat, {});
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("presence")
        .withIndex("by_user", (q) => q.eq("userId", stale.userId))
        .unique();
      await ctx.db.patch(row!._id, {
        lastSeen: Date.now() - PRESENCE_STALE_MS - 1000,
      });
    });

    await t.mutation(internal.maintenance.sweepAll, {});

    const rows = await t.run((ctx) => ctx.db.query("presence").collect());
    expect(rows.map((r) => r.userId)).toEqual([fresh.userId]);
  });

  it("clears a typing indicator nobody explicitly stopped, once stale", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { serverId, defaultChannelId } = await owner.as.mutation(
      api.servers.create,
      { name: "T" },
    );
    void serverId;
    await owner.as.mutation(api.typing.ping, {
      scopeType: "channel",
      scopeId: defaultChannelId,
    });

    // Not yet stale — survives a sweep.
    await t.mutation(internal.maintenance.sweepAll, {});
    let rows = await t.run((ctx) => ctx.db.query("typingIndicators").collect());
    expect(rows).toHaveLength(1);

    // Age it past the staleness window.
    await t.run(async (ctx) => {
      await ctx.db.patch(rows[0]._id, {
        updatedAt: Date.now() - TYPING_STALE_MS - 1000,
      });
    });
    await t.mutation(internal.maintenance.sweepAll, {});
    rows = await t.run((ctx) => ctx.db.query("typingIndicators").collect());
    expect(rows).toHaveLength(0);
  });
});
