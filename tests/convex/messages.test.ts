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
  return { t, owner, member, channelId: defaultChannelId };
}

// T035 — messaging authorization & validation (FR-016a, FR-018).
describe("messages authorization (US3)", () => {
  it("rejects a message over 2000 characters (FR-016a)", async () => {
    const { owner, channelId } = await setup();
    await expect(
      owner.as.mutation(api.messages.send, {
        channelId,
        content: "x".repeat(2001),
      }),
    ).rejects.toThrow();
  });

  it("rejects a non-author editing or deleting a message (FR-018)", async () => {
    const { owner, member, channelId } = await setup();
    const { messageId } = await owner.as.mutation(api.messages.send, {
      channelId,
      content: "owner's message",
    });
    await expect(
      member.as.mutation(api.messages.edit, {
        messageId,
        content: "hacked",
      }),
    ).rejects.toThrow();
    await expect(
      member.as.mutation(api.messages.remove, { messageId }),
    ).rejects.toThrow();
  });

  it("lets the author edit (marks edited) and delete their message (FR-018)", async () => {
    const { t, owner, channelId } = await setup();
    const { messageId } = await owner.as.mutation(api.messages.send, {
      channelId,
      content: "first",
    });

    await owner.as.mutation(api.messages.edit, {
      messageId,
      content: "edited",
    });
    const edited = await t.run((ctx) => ctx.db.get(messageId));
    expect(edited?.content).toBe("edited");
    expect(edited?.editedAt).toBeGreaterThan(0);

    await owner.as.mutation(api.messages.remove, { messageId });
    const gone = await t.run((ctx) => ctx.db.get(messageId));
    expect(gone).toBeNull();
  });

  it("rejects sending in a server the caller is not a member of", async () => {
    const { t, channelId } = await setup();
    const stranger = await makeUser(t, "Stranger");
    await expect(
      stranger.as.mutation(api.messages.send, {
        channelId,
        content: "intruder",
      }),
    ).rejects.toThrow();
  });
});
