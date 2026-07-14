import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

// convex-test needs the function modules since this test lives outside convex/.
const modules = import.meta.glob("../../convex/**/*.*s");

// T022 — every protected function requires authentication (FR-004).
describe("authorization guards (FR-004)", () => {
  it("rejects unauthenticated users.me", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.users.me, {})).rejects.toThrow();
  });

  it("rejects unauthenticated presence.heartbeat", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.presence.heartbeat, {})).rejects.toThrow();
  });

  it("allows an authenticated user and returns their own profile", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "Ada" }),
    );
    const asUser = t.withIdentity({ subject: `${userId}|session1` });

    const me = await asUser.query(api.users.me, {});
    expect(me?.name).toBe("Ada");

    // Heartbeat writes a presence row that reads back for that user.
    await asUser.mutation(api.presence.heartbeat, {});
    const presence = await asUser.query(api.presence.listForUsers, {
      userIds: [userId],
    });
    expect(presence[0]?.lastSeen).toBeGreaterThan(0);
  });

  it("updateProfile enforces display-name length", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "Ada" }),
    );
    const asUser = t.withIdentity({ subject: `${userId}|session1` });
    await expect(
      asUser.mutation(api.users.updateProfile, { name: "x".repeat(33) }),
    ).rejects.toThrow();
  });
});
