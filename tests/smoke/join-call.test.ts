import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const modules = import.meta.glob("../../convex/**/*.*s");
type T = ReturnType<typeof convexTest>;

async function makeUser(t: T, name: string) {
  const userId = (await t.run((ctx) =>
    ctx.db.insert("users", { name }),
  )) as Id<"users">;
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

// T050 — smoke test for the critical "join call" flow (Constitution VI):
// joining a voice channel puts the participant on the roster and wires signaling.
describe("smoke: join call", () => {
  it("calls.join adds the participant to the roster and signals are delivered", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const member = await makeUser(t, "Member");

    const { serverId } = await owner.as.mutation(api.servers.create, {
      name: "Call Server",
    });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    await member.as.mutation(api.servers.joinByInvite, {
      inviteCode: server!.inviteCode,
    });
    const { channelId } = await owner.as.mutation(api.channels.create, {
      serverId,
      name: "Lounge",
      type: "voice",
    });

    const { callId } = await owner.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId,
    });
    const joined = await member.as.mutation(api.calls.join, {
      scopeType: "channel",
      channelId,
    });
    expect(joined.callId).toBe(callId);

    const roster = await owner.as.query(api.calls.roster, { callId });
    expect(roster.map((p) => p.userId).sort()).toEqual(
      [owner.userId, member.userId].sort(),
    );
    expect(roster.find((p) => p.userId === owner.userId)?.micEnabled).toBe(true);
    expect(roster.find((p) => p.userId === owner.userId)?.cameraEnabled).toBe(
      false,
    );

    // Signaling is wired: a signal sent to the member is delivered via their inbox.
    await owner.as.mutation(api.signals.send, {
      callId,
      toUserId: member.userId,
      kind: "offer",
      payload: "fake-sdp-offer",
    });
    const inbox = await member.as.query(api.signals.inbox, { callId });
    expect(inbox).toHaveLength(1);
    expect(inbox[0].payload).toBe("fake-sdp-offer");
    expect(inbox[0].fromUserId).toBe(owner.userId);

    await member.as.mutation(api.signals.ack, { signalId: inbox[0]._id });
    const afterAck = await member.as.query(api.signals.inbox, { callId });
    expect(afterAck).toHaveLength(0);
  });
});
