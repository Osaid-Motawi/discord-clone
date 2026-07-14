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

// T034 — smoke test for the critical "send message" flow (Constitution VI):
// a message sent by one member is visible to another member of the channel.
describe("smoke: send message", () => {
  it("a sent message is visible to another channel member in real time", async () => {
    const t = convexTest(schema, modules);
    const owner = await makeUser(t, "Owner");
    const member = await makeUser(t, "Member");

    const { serverId, defaultChannelId } = await owner.as.mutation(
      api.servers.create,
      { name: "Smoke" },
    );
    const server = await t.run((ctx) => ctx.db.get(serverId));
    await member.as.mutation(api.servers.joinByInvite, {
      inviteCode: server!.inviteCode,
    });

    await owner.as.mutation(api.messages.send, {
      channelId: defaultChannelId,
      content: "hello world",
    });

    const page = await member.as.query(api.messages.list, {
      channelId: defaultChannelId,
      paginationOpts: { numItems: 20, cursor: null },
    });

    expect(page.page.length).toBe(1);
    expect(page.page[0].content).toBe("hello world");
    expect(page.page[0].authorName).toBe("Owner");
  });
});
