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

async function setup() {
  const t = convexTest(schema, modules);
  const owner = await makeUser(t, "Owner");
  const member = await makeUser(t, "Member");
  const { serverId, defaultChannelId } = await owner.as.mutation(
    api.servers.create,
    { name: "T" },
  );
  const server = await t.run((ctx) => ctx.db.get(serverId));
  await member.as.mutation(api.servers.joinByInvite, {
    inviteCode: server!.inviteCode,
  });
  return { t, owner, member, serverId, defaultChannelId };
}

// T038 — channel management authorization + cascade (FR-012/013/014).
describe("channels authorization (US4)", () => {
  it("owner can create text & voice channels; all members see them (FR-012/013)", async () => {
    const { owner, member, serverId } = await setup();
    await owner.as.mutation(api.channels.create, {
      serverId,
      name: "random",
      type: "text",
    });
    await owner.as.mutation(api.channels.create, {
      serverId,
      name: "Lounge",
      type: "voice",
    });
    const seen = await member.as.query(api.channels.list, { serverId });
    const names = seen.map((c) => c.name).sort();
    expect(names).toEqual(["Lounge", "general", "random"]);
    expect(seen.find((c) => c.name === "Lounge")?.type).toBe("voice");
  });

  it("rejects channel create/rename/delete from non-owners (FR-013)", async () => {
    const { member, serverId, defaultChannelId } = await setup();
    await expect(
      member.as.mutation(api.channels.create, {
        serverId,
        name: "nope",
        type: "text",
      }),
    ).rejects.toThrow();
    await expect(
      member.as.mutation(api.channels.rename, {
        channelId: defaultChannelId,
        name: "hacked",
      }),
    ).rejects.toThrow();
    await expect(
      member.as.mutation(api.channels.remove, {
        channelId: defaultChannelId,
      }),
    ).rejects.toThrow();
  });

  it("deleting a channel removes its messages (FR-014)", async () => {
    const { t, owner, defaultChannelId } = await setup();
    const { messageId } = await owner.as.mutation(api.messages.send, {
      channelId: defaultChannelId,
      content: "to be deleted",
    });
    await owner.as.mutation(api.channels.remove, {
      channelId: defaultChannelId,
    });
    const channel = await t.run((ctx) => ctx.db.get(defaultChannelId));
    const message = await t.run((ctx) => ctx.db.get(messageId));
    expect(channel).toBeNull();
    expect(message).toBeNull();
  });

  it("owner can rename a channel (FR-013)", async () => {
    const { t, owner, defaultChannelId } = await setup();
    await owner.as.mutation(api.channels.rename, {
      channelId: defaultChannelId,
      name: "renamed",
    });
    const channel = await t.run((ctx) => ctx.db.get(defaultChannelId));
    expect(channel?.name).toBe("renamed");
  });
});
