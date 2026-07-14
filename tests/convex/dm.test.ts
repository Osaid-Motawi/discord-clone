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

/** Owner creates a server; `member` joins so they share a server. */
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
}

// T042 — Direct message authorization & dedupe (FR-021/022/023).
describe("direct messages (US5)", () => {
  it("reuses an existing thread instead of creating a duplicate (FR-023)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    await sharedServer(t, a, b);

    const first = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });
    // Opening again from either side returns the same thread.
    const again = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });
    const fromB = await b.as.mutation(api.directMessages.openThread, {
      otherUserId: a.userId,
    });
    expect(again.threadId).toBe(first.threadId);
    expect(fromB.threadId).toBe(first.threadId);

    const allThreads = await t.run((ctx) =>
      ctx.db.query("directMessageThreads").collect(),
    );
    expect(allThreads.length).toBe(1);
  });

  it("rejects opening a DM with someone who shares no server (FR-021)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const stranger = await makeUser(t, "Stranger");
    await expect(
      a.as.mutation(api.directMessages.openThread, {
        otherUserId: stranger.userId,
      }),
    ).rejects.toThrow();
  });

  it("delivers DMs and enforces author-only edit/delete (FR-022)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    const { messageId } = await a.as.mutation(api.directMessages.send, {
      threadId,
      content: "hi B",
    });
    // B can read it.
    const page = await b.as.query(api.directMessages.list, {
      threadId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(page.page[0]?.content).toBe("hi B");

    // B cannot edit/delete A's message.
    await expect(
      b.as.mutation(api.directMessages.edit, { messageId, content: "x" }),
    ).rejects.toThrow();
    await expect(
      b.as.mutation(api.directMessages.remove, { messageId }),
    ).rejects.toThrow();

    // A can edit (marks edited).
    await a.as.mutation(api.directMessages.edit, {
      messageId,
      content: "hi B (edited)",
    });
    const edited = await t.run((ctx) => ctx.db.get(messageId));
    expect(edited?.editedAt).toBeGreaterThan(0);
  });

  it("rejects a non-participant reading the thread (FR-021)", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    const c = await makeUser(t, "C");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });
    await expect(
      c.as.query(api.directMessages.list, {
        threadId,
        paginationOpts: { numItems: 20, cursor: null },
      }),
    ).rejects.toThrow();
  });

  // FR-023a — unread DM badges (post-v1 addition, see spec.md).
  it("counts the other participant's messages as unread until markRead", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });

    // No messages yet — nothing unread.
    let threadsForA = await a.as.query(api.directMessages.listThreads, {});
    expect(threadsForA.find((x) => x.threadId === threadId)?.unreadCount).toBe(0);

    // B sends two messages; A's own messages (sent below) must not count.
    await b.as.mutation(api.directMessages.send, { threadId, content: "hi" });
    await b.as.mutation(api.directMessages.send, { threadId, content: "there" });
    await a.as.mutation(api.directMessages.send, { threadId, content: "hey" });

    threadsForA = await a.as.query(api.directMessages.listThreads, {});
    expect(threadsForA.find((x) => x.threadId === threadId)?.unreadCount).toBe(2);
    expect(await a.as.query(api.directMessages.unreadTotal, {})).toBe(2);

    // Marking read clears it for A but does not affect B's own count of A's reply.
    await a.as.mutation(api.directMessages.markRead, { threadId });
    threadsForA = await a.as.query(api.directMessages.listThreads, {});
    expect(threadsForA.find((x) => x.threadId === threadId)?.unreadCount).toBe(0);
    expect(await a.as.query(api.directMessages.unreadTotal, {})).toBe(0);

    const threadsForB = await b.as.query(api.directMessages.listThreads, {});
    expect(threadsForB.find((x) => x.threadId === threadId)?.unreadCount).toBe(1);
  });

  it("rejects markRead from a non-participant", async () => {
    const t = convexTest(schema, modules);
    const a = await makeUser(t, "A");
    const b = await makeUser(t, "B");
    const stranger = await makeUser(t, "Stranger");
    await sharedServer(t, a, b);
    const { threadId } = await a.as.mutation(api.directMessages.openThread, {
      otherUserId: b.userId,
    });
    await expect(
      stranger.as.mutation(api.directMessages.markRead, { threadId }),
    ).rejects.toThrow();
  });
});
