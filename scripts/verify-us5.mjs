// Ad-hoc end-to-end check for US5 direct messages against the local deployment.
// Run: node scripts/verify-us5.mjs
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";

async function signUp(name) {
  const client = new ConvexHttpClient(url);
  const res = await client.action(api.auth.signIn, {
    provider: "password",
    params: {
      email: `${name}+${Date.now()}@example.com`,
      password: "Password123!",
      flow: "signUp",
      name,
    },
  });
  client.setAuth(res.tokens.token);
  client._id = (await client.query(api.users.me, {}))._id;
  return client;
}

async function main() {
  const a = await signUp("Ada");
  const b = await signUp("Bea");
  const stranger = await signUp("Stranger");

  // A and B share a server; stranger does not.
  const { serverId } = await a.mutation(api.servers.create, { name: "DM Server" });
  const server = await a.query(api.servers.get, { serverId });
  await b.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });

  const bId = (await a.query(api.servers.listMembers, { serverId })).find(
    (m) => m.name === "Bea",
  ).userId;

  // Open DM + dedupe.
  const { threadId } = await a.mutation(api.directMessages.openThread, {
    otherUserId: bId,
  });
  const again = await a.mutation(api.directMessages.openThread, {
    otherUserId: bId,
  });
  if (again.threadId !== threadId) throw new Error("duplicate thread created");
  console.log("✓ opening the DM twice reuses the same thread");

  // Real-time delivery.
  await a.mutation(api.directMessages.send, { threadId, content: "hey Bea" });
  const page = await b.query(api.directMessages.list, {
    threadId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page.page[0]?.content !== "hey Bea")
    throw new Error("B did not receive the DM");
  console.log("✓ B receives the DM in the shared thread");

  // No shared server → cannot DM stranger.
  const aId = a._id;
  let rejected = false;
  try {
    await stranger.mutation(api.directMessages.openThread, { otherUserId: aId });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("DM with non-shared user was allowed");
  console.log("✓ DM with a non-shared user is rejected");

  // Typing indicator in the DM scope.
  await a.mutation(api.typing.ping, { scopeType: "dm", scopeId: threadId });
  const typers = await b.query(api.typing.list, {
    scopeType: "dm",
    scopeId: threadId,
  });
  if (!typers.some((x) => x.name === "Ada"))
    throw new Error("DM typing indicator not visible");
  console.log("✓ DM typing indicator visible to the other participant");

  console.log("\nALL US5 CHECKS PASSED");
}

main().catch((err) => {
  console.error("US5 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
