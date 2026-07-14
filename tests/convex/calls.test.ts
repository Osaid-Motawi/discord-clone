import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CALL_STALE_MS } from "../../convex/model/validators";

const modules = import.meta.glob("../../convex/**/*.*s");
type T = ReturnType<typeof convexTest>;
type Identity = ReturnType<T["withIdentity"]>;

async function makeUser(t: T, name: string) {
  const userId = (await t.run((ctx) =>
    ctx.db.insert("users", { name }),
  )) as Id<"users">;
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

async function serverWithVoiceChannel(t: T, owner: { as: Identity }) {
  const { serverId } = await owner.as.mutation(api.servers.create, {
    name: "Calls",
  });
  const { channelId } = await owner.as.mutation(api.channels.create, {
    serverId,
    name: "Lounge",
    type: "voice",
  });
  return { serverId, channelId };
}

async function joinServer(
  t: T,
  serverId: Id<"servers">,
  user: { as: Identity },
) {
  const server = await t.run((ctx) => ctx.db.get(serverId));
  await user.as.mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
}

// T052 — calls authorization & invariants (FR-025, FR-031, FR-032).
describe("calls (US6)", () => {
  it("rejects joining a call that is already at capacity (FR-025)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { serverId, channelId } = await serverWithVoiceChannel(t, owner);

    const members = await Promise.all(
      ["B", "C", "D", "E"].map((n) => makeUser(t, n)),
    );
    for (const m of members) await joinServer(t, serverId, m);

    // Owner + B + C + D fill the call to capacity (4).
    await owner.as.mutation(api.calls.join, { scopeType: "channel", channelId });
    for (const m of members.slice(0, 3)) {
      await m.as.mutation(api.calls.join, { scopeType: "channel", channelId });
    }

    // The 5th joiner (E) is rejected.
    await expect(
      members[3].as.mutation(api.calls.join, {
        scopeType: "channel",
        channelId,
      }),
    ).rejects.toThrow();
  });

  it("enforces a single active call per user — joining elsewhere leaves the previous call (FR-032)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { serverId, channelId: channelA } = await serverWithVoiceChannel(
      t,
      owner,
    );
    const { channelId: channelB } = await owner.as.mutation(
      api.channels.create,
      { serverId, name: "Second Voice", type: "voice" },
    );

    const { callId: callA } = await owner.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId: channelA,
    });
    const { callId: callB } = await owner.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId: channelB,
    });

    expect(callB).not.toBe(callA);
    const rosterA = await owner.as.query(api.calls.roster, { callId: callA });
    const rosterB = await owner.as.query(api.calls.roster, { callId: callB });
    expect(rosterA).toHaveLength(0);
    expect(rosterB.map((p) => p.userId)).toEqual([owner.userId]);

    const callADoc = await t.run((ctx) => ctx.db.get(callA));
    expect(callADoc?.active).toBe(false);
  });

  it("sweeps a participant whose heartbeat has gone stale (FR-031)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { channelId } = await serverWithVoiceChannel(t, owner);

    const { callId } = await owner.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId,
    });

    // Age the participant's heartbeat past the staleness threshold.
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_user", (q) =>
          q.eq("callId", callId).eq("userId", owner.userId),
        )
        .unique();
      await ctx.db.patch(row!._id, {
        lastSeen: Date.now() - CALL_STALE_MS - 1000,
      });
    });

    await t.mutation(internal.maintenance.sweepAll, {});

    const roster = await owner.as.query(api.calls.roster, { callId });
    expect(roster).toHaveLength(0);
    const callDoc = await t.run((ctx) => ctx.db.get(callId));
    expect(callDoc?.active).toBe(false);
  });

  it("rejects joining a voice channel from a non-member (authorization)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const stranger = await makeUser(t, "Stranger");
    const { channelId } = await serverWithVoiceChannel(t, owner);

    await expect(
      stranger.as.mutation(api.calls.join, {
        scopeType: "channel",
        channelId,
      }),
    ).rejects.toThrow();
  });
});
