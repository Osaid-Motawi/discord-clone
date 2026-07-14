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

async function inviteCodeOf(t: T, serverId: Id<"servers">) {
  const server = await t.run((ctx) => ctx.db.get(serverId));
  if (server === null) throw new Error("server missing");
  return server.inviteCode;
}

// T028 — Servers & Membership authorization (FR-006/007/009/010/010a).
describe("servers authorization (US2)", () => {
  it("rejects owner-only actions from non-owners (FR-009)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const member = await makeUser(t, "Member");
    const { serverId } = await owner.as.mutation(api.servers.create, {
      name: "Test",
    });
    await member.as.mutation(api.servers.joinByInvite, {
      inviteCode: await inviteCodeOf(t, serverId),
    });

    await expect(
      member.as.mutation(api.servers.rename, { serverId, name: "Hacked" }),
    ).rejects.toThrow();
    await expect(
      member.as.mutation(api.servers.removeMember, {
        serverId,
        userId: owner.userId,
      }),
    ).rejects.toThrow();
  });

  it("rejects an invalid invite code (FR-007)", async () => {
    const t = convexTest(schema, modules);
    const u = await makeUser(t, "U");
    await expect(
      u.as.mutation(api.servers.joinByInvite, { inviteCode: "does-not-exist" }),
    ).rejects.toThrow();
  });

  it("removed member loses access but their messages are retained (FR-010/010a)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const member = await makeUser(t, "Member");
    const { serverId, defaultChannelId } = await owner.as.mutation(
      api.servers.create,
      { name: "T" },
    );
    await member.as.mutation(api.servers.joinByInvite, {
      inviteCode: await inviteCodeOf(t, serverId),
    });

    const messageId = (await t.run((ctx) =>
      ctx.db.insert("messages", {
        channelId: defaultChannelId,
        authorId: member.userId,
        content: "hello",
      }),
    )) as Id<"messages">;

    await owner.as.mutation(api.servers.removeMember, {
      serverId,
      userId: member.userId,
    });

    // Removed member can no longer read the server.
    await expect(
      member.as.query(api.servers.get, { serverId }),
    ).rejects.toThrow();
    // Their message survives (FR-010a).
    const message = await t.run((ctx) => ctx.db.get(messageId));
    expect(message).not.toBeNull();
  });

  it("regenerating an invite invalidates the old code (FR-006)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { serverId } = await owner.as.mutation(api.servers.create, {
      name: "T",
    });
    const oldCode = await inviteCodeOf(t, serverId);
    const { inviteCode: newCode } = await owner.as.mutation(
      api.servers.generateInvite,
      { serverId },
    );
    expect(newCode).not.toBe(oldCode);

    const stranger = await makeUser(t, "S");
    await expect(
      stranger.as.mutation(api.servers.joinByInvite, { inviteCode: oldCode }),
    ).rejects.toThrow();
    const { serverId: joined } = await stranger.as.mutation(
      api.servers.joinByInvite,
      { inviteCode: newCode },
    );
    expect(joined).toBe(serverId);
  });

  it("owner-created server has a default #general text channel (FR-011)", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const { serverId, defaultChannelId } = await owner.as.mutation(
      api.servers.create,
      { name: "T" },
    );
    const channel = await t.run((ctx) => ctx.db.get(defaultChannelId));
    expect(channel?.name).toBe("general");
    expect(channel?.type).toBe("text");
    expect(channel?.serverId).toBe(serverId);
  });
});
