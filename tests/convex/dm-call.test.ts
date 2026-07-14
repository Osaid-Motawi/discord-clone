import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.*s");
type T = ReturnType<typeof convexTest>;
type Identity = ReturnType<T["withIdentity"]>;

async function makeUser(t: T, name: string) {
  const userId = (await t.run((ctx) =>
    ctx.db.insert("users", { name }),
  )) as Id<"users">;
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

/** Owner creates a server; `member` joins so they share a server (DM eligibility). */
async function sharedServer(
  t: T,
  owner: { as: Identity },
  member: { as: Identity },
) {
  const { serverId } = await owner.as.mutation(api.servers.create, {
    name: "Shared",
  });
  const server = await t.run((ctx) => ctx.db.get(serverId));
  await member.as.mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  return serverId;
}

// T055 — 1-on-1 DM calls (FR-030) and single-active-call across DM ↔ voice channel (FR-032).
describe("DM calls (US7)", () => {
  it("starting a DM call is visible to the other participant, who can then join (FR-030, US7 #1)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    // Before anyone joins, there's no active call for the thread.
    expect(await b.as.query(api.calls.activeForThread, { threadId })).toBeNull();

    const { callId } = await a.as.mutation(api.calls.join, {
      scopeType: "dm",
      threadId,
    });

    // B's reactive query now shows an active call — they can join it.
    const active = await b.as.query(api.calls.activeForThread, { threadId });
    expect(active?.callId).toBe(callId);
    expect(active?.participantCount).toBe(1);

    const joined = await b.as.mutation(api.calls.join, {
      scopeType: "dm",
      threadId,
    });
    expect(joined.callId).toBe(callId);

    const roster = await a.as.query(api.calls.roster, { callId });
    expect(roster.map((p) => p.userId).sort()).toEqual(
      [a.userId, b.userId].sort(),
    );
  });

  it("leaving ends the call for that participant only (US7 #3)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    const { callId } = await a.as.mutation(api.calls.join, {
      scopeType: "dm",
      threadId,
    });
    await b.as.mutation(api.calls.join, { scopeType: "dm", threadId });

    await a.as.mutation(api.calls.leave, { callId });
    const roster = await b.as.query(api.calls.roster, { callId });
    expect(roster.map((p) => p.userId)).toEqual([b.userId]);

    const callDoc = await t.run((ctx) => ctx.db.get(callId));
    expect(callDoc?.active).toBe(true); // B is still connected
  });

  it("a non-participant cannot join or see the DM call (authorization)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    const stranger = await makeUser(t, "Stranger");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    await expect(
      stranger.as.mutation(api.calls.join, { scopeType: "dm", threadId }),
    ).rejects.toThrow();
    await expect(
      stranger.as.query(api.calls.activeForThread, { threadId }),
    ).rejects.toThrow();
  });

  it("single active call holds across a voice channel and a DM call (FR-032)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    const serverId = await sharedServer(t, a, b);
    const { channelId } = await a.as.mutation(api.channels.create, {
      serverId,
      name: "Lounge",
      type: "voice",
    });
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    const { callId: voiceCallId } = await a.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId,
    });
    const { callId: dmCallId } = await a.as.mutation(api.calls.join, {
      scopeType: "dm",
      threadId,
    });

    expect(dmCallId).not.toBe(voiceCallId);
    const voiceRoster = await b.as.query(api.calls.roster, {
      callId: voiceCallId,
    });
    expect(voiceRoster).toHaveLength(0);
    const voiceCallDoc = await t.run((ctx) => ctx.db.get(voiceCallId));
    expect(voiceCallDoc?.active).toBe(false);

    const dmRoster = await b.as.query(api.calls.roster, { callId: dmCallId });
    expect(dmRoster.map((p) => p.userId)).toEqual([a.userId]);
  });
});
